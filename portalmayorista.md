# HEFA — Canal Mayorista v1

Implementá un canal mayorista completo en el sitio Next.js App Router existente. No dupliques productos: el catálogo mayorista reutiliza los productos minoristas existentes, solo cambia el precio (calculado por regla) y qué productos participan. Trabajá por fases en el orden indicado. Usá TypeScript, PostgreSQL (Railway) y los componentes existentes del sitio donde sea posible.

---

## FASE 1 — Schema de base de datos

Creá las migraciones para:

**Tabla `mayoristas`:**
- `id` (serial PK)
- `nombre` (text, not null)
- `apellido` (text, not null)
- `usuario` (text, unique, not null)
- `password_hash` (text, not null) — bcrypt
- `celular` (text, nullable)
- `email` (text, nullable) — al menos uno de celular/email debe existir (validar en aplicación)
- `nombre_local` (text, not null)
- `ubicacion_local` (text, not null)
- `estado` (enum: 'pendiente' | 'activo' | 'rechazado' | 'suspendido', default 'pendiente')
- `vendedor_id` (FK a vendedores, nullable)
- `created_at`, `updated_at`, `activado_at` (nullable)

**Tabla `vendedores`:**
- `id` (serial PK)
- `nombre` (text, not null)
- `celular_wa` (text, not null) — formato internacional sin símbolos, ej 5491122334455
- `email` (text, nullable)
- `activo` (boolean, default true)

**Tabla `configuracion_mayorista`** (una sola fila):
- `id` (serial PK)
- `descuento_porcentaje` (numeric, default 25) — descuento sobre precio minorista
- `redondeo` (integer, default 100) — redondear precio calculado al múltiplo superior más cercano (ceil), 0 = sin redondeo
- `monto_minimo_pedido` (numeric, default 0) — 0 = sin mínimo
- `updated_at`

La migración debe incluir un `INSERT` de la fila default con los valores arriba indicados. La aplicación siempre lee esta única fila; nunca inserta más.

**Campos nuevos en la tabla de productos existente:**
- `es_mayorista` (boolean, default false)
- `precio_mayorista_override` (numeric, nullable) — si tiene valor, pisa el cálculo por regla

**Tabla `pedidos_mayoristas`:**
- `id` (serial PK)
- `mayorista_id` (FK)
- `vendedor_nombre` (text, nullable) — snapshot del nombre del vendedor al momento del pedido
- `vendedor_celular_wa` (text, nullable) — snapshot del celular WA del vendedor al momento del pedido
- `estado` (enum: 'recibido' | 'confirmado' | 'preparando' | 'entregado' | 'cancelado', default 'recibido')
- `total` (numeric)
- `notas` (text, nullable) — campo libre del mayorista en checkout
- `modificado_at` (timestamp, nullable)
- `modificado_por` (text, nullable) — nombre del admin que realizó la última edición (snapshot)
- `created_at`, `updated_at`

**Tabla `pedidos_mayoristas_items`:**
- `id` (serial PK)
- `pedido_id` (FK)
- `producto_id` (FK)
- `nombre_producto` (text) — snapshot al momento del pedido
- `cantidad` (integer)
- `precio_unitario` (numeric) — snapshot del precio mayorista al momento del pedido
- `precio_original` (numeric, nullable) — se escribe SOLO en la primera edición del item (nunca sobreescribir si ya tiene valor); permite comparar precio acordado vs. original
- `subtotal` (numeric)

**Notas de stock:**
- El canal mayorista no distingue colores ni depósitos. El stock disponible de un producto es la suma de todas sus variantes de color en todos los depósitos.
- La validación de stock al confirmar el pedido usa este total agregado.
- El mayorista no elige color; HEFA entrega según disponibilidad.

---

## FASE 2 — Lógica de precio mayorista

Creá `lib/precios-mayorista.ts` con una función pura:

```
calcularPrecioMayorista(precioMinorista, override, config): number
```

Reglas:
1. Si `override` no es null, devolvé el override.
2. Si no: `precioMinorista * (1 - descuento_porcentaje / 100)`.
3. Si `config.redondeo > 0`, aplicá `Math.ceil(precio / redondeo) * redondeo` (siempre redondear hacia arriba, nunca bajar el precio).

El precio mayorista nunca se persiste en el producto. Se calcula siempre al momento de mostrar. La única persistencia de precio es el snapshot en `pedidos_mayoristas_items` al confirmar un pedido.

Escribí tests unitarios de esta función (casos: sin override, con override, redondeo a 100 con ceil, redondeo 0, descuento 0).

---

## FASE 3 — Solicitud de acceso y autenticación

### Rutas públicas

**`/mayoristas`** — Landing pública:
- Hero explicando el canal mayorista de HEFA (precios especiales para revendedores y comercios, compra con cuenta aprobada).
- Dos CTA: "Iniciar sesión" y "Solicitá tu código de acceso".
- Formulario de login (usuario + password) inline o en `/mayoristas/login`.

**`/mayoristas/solicitud`** — Formulario de solicitud con campos:
- Nombre, Apellido (obligatorios)
- Usuario deseado (obligatorio)
- Password (obligatorio, mínimo 8 caracteres, confirmar password)
- Celular y Email (al menos uno obligatorio, validar formato)
- Nombre del local (obligatorio)
- Ubicación del local (obligatorio, texto libre: localidad + dirección)
- Campo honeypot oculto (CSS `display:none`, sin `aria-hidden`). Si viene con valor en el POST, responder 200 con pantalla de confirmación falsa sin crear el registro ni loguear nada.

Al enviar:
1. Crear registro en `mayoristas` con estado `pendiente` y password hasheado con bcrypt.
2. Si el `usuario` ya existe (violación del UNIQUE constraint de la DB), devolver error amigable "Ese usuario ya está en uso. Elegí otro." sin revelar si la cuenta está activa o pendiente.
3. Disparar POST al webhook n8n `N8N_WEBHOOK_SOLICITUD_MAYORISTA` (env var) con payload definido en FASE 6.
4. Mostrar pantalla de confirmación: "Recibimos tu solicitud. Te vamos a contactar para activar tu cuenta."
5. Si el webhook falla, el registro igual queda creado; logueá el error, no bloquees al usuario.

### Autenticación

- Login con usuario + password contra `mayoristas` donde `estado = 'activo'`.
- Para usuarios existentes en cualquier estado: siempre comparar el password con `bcrypt.compare` antes de evaluar el estado (evitar user enumeration por timing).
- Mensajes de error:
  - Usuario inexistente o password incorrecta: "Usuario o contraseña incorrectos." (mensaje idéntico, no revelar cuál falló).
  - Estado `pendiente`: "Tu cuenta todavía no fue activada."
  - Estado `suspendido` o `rechazado`: "No pudimos iniciar sesión. Contactanos por WhatsApp."
- Nunca loguear passwords ni hashes.
- Sesión: JWT firmado con **`jose`** (Edge Runtime-compatible, no `jsonwebtoken`). Cookie httpOnly, secure, sameSite lax, expiración **7 días**. Secret en env var `MAYORISTA_JWT_SECRET`. El payload incluye `mayorista_id` y `estado`.
- Middleware de Next.js que protege `/mayoristas/catalogo`, `/mayoristas/carrito` y `/mayoristas/pedido/*`:
  - Verifica firma y expiración del JWT.
  - **Revalida contra DB** que el mayorista siga con `estado = 'activo'`. Si ya no está activo, invalida la cookie y redirige a `/mayoristas`.
  - Sin sesión válida: redirige a `/mayoristas`.
- Logout que borra la cookie.

### Rate limiting

Implementación in-memory con `Map` + TTL (suficiente para Railway single instance; no requiere tabla extra en DB):

- **Login mayorista**: máximo 5 intentos fallidos por IP cada 15 minutos, y máximo 5 intentos fallidos por usuario cada 15 minutos (independiente de la IP). Al superar el límite, responder 429 con "Demasiados intentos. Probá de nuevo en unos minutos." Resetear el contador al loguearse correctamente.
- **Formulario de solicitud**: máximo 3 solicitudes por IP por hora. El honeypot (ver arriba) corre antes del rate limit check.

---

## FASE 4 — Catálogo y carrito mayorista

### `/mayoristas/catalogo` (protegida)

- Listá solo productos con `es_mayorista = true` y stock disponible (suma de todas las variantes de color en todos los depósitos > 0).
- Reutilizá los componentes de card de producto existentes. Cambios:
  - Precio mostrado = `calcularPrecioMayorista(...)`, calculado server-side.
  - Badge o etiqueta "Precio mayorista".
  - Selector de cantidad en la card (input numérico + botones +/−) y botón "Agregar al pedido".
  - No mostrar selector de color (el mayorista no elige color).
- Mantené filtros/categorías/búsqueda del catálogo minorista si existen como componentes reutilizables.
- Header del catálogo: nombre del local del mayorista logueado, link al carrito con contador de items, logout.

### Carrito mayorista (`/mayoristas/carrito`)

- Carrito propio, separado del minorista. Estado en `localStorage` con clave `hefa_carrito_mayorista`, manejado con Zustand persist. No mezclar con el carrito minorista existente.
- Listado de items con cantidad editable, subtotales y total.
- Si `monto_minimo_pedido > 0` y el total no llega: mostrá cuánto falta y deshabilitá el botón de confirmar.
- Campo opcional "Notas del pedido".
- Botón "Confirmar pedido" (sin gateway de pago):
  1. Validar stock server-side (suma de todas las variantes de color en todos los depósitos) y recalcular precios server-side al momento de confirmar. Nunca confiar en los precios del cliente.
  2. Crear `pedidos_mayoristas` con snapshot de `vendedor_nombre` y `vendedor_celular_wa` del vendedor asignado al mayorista al momento del pedido.
  3. Crear items con snapshots de precio y nombre de producto.
  4. Disparar POST al webhook `N8N_WEBHOOK_PEDIDO_MAYORISTA` con payload de FASE 6.
  5. Vaciar el carrito y redirigir a `/mayoristas/pedido/[id]` con resumen y mensaje "Pedido recibido. Tu vendedor se va a contactar para coordinar pago y entrega."

### `/mayoristas/pedido/[id]` (protegida)

- Detalle del pedido: items, cantidades, precios, total, estado, fecha. Solo accesible por el mayorista dueño del pedido.
- Muestra siempre la versión vigente del pedido (post-edición del admin).
- Listado de pedidos previos del mayorista en `/mayoristas/pedidos`.

---

## FASE 5 — Panel admin

Agregá a la sección de administración existente:

### Solicitudes y mayoristas (`/admin/mayoristas`)

- Tabla de mayoristas con filtro por estado. Pendientes primero.
- Detalle de cada solicitud con todos los datos del formulario.
- Acciones:
  - **Aprobar**: abre selector de vendedor (dropdown de `vendedores` activos, obligatorio). Al confirmar: estado → `activo`, setea `vendedor_id` y `activado_at`, dispara POST al webhook `N8N_WEBHOOK_ACTIVACION_MAYORISTA` con payload de FASE 6.
  - **Rechazar**: estado → `rechazado`.
  - **Suspender / Reactivar**: alterna entre `suspendido` y `activo` (reactivar no re-dispara el webhook de bienvenida).
  - **Reasignar vendedor** en mayoristas activos.

### Vendedores (`/admin/vendedores`)

- ABM simple: nombre, celular WA, email, activo.

### Configuración mayorista (`/admin/mayoristas/configuracion`)

- Formulario con: descuento %, redondeo (ceil al múltiplo indicado), monto mínimo de pedido.
- Preview en vivo: campo para tipear un precio minorista de prueba y ver el precio mayorista resultante con la config actual.

### Productos

- En el editor de producto existente: toggle "Visible en catálogo mayorista" (`es_mayorista`) y campo "Precio mayorista manual" (`precio_mayorista_override`, opcional, con leyenda "Si lo dejás vacío se aplica el descuento general").
- En el listado de productos del admin: acción masiva para marcar/desmarcar `es_mayorista` en productos seleccionados, y columna o indicador visual de qué productos están en el canal mayorista.

### Pedidos mayoristas (`/admin/mayoristas/pedidos`)

- Listado con filtros por estado y por mayorista, ordenado por fecha descendente.
- Detalle con items y datos de contacto del mayorista y su vendedor.
- Cambio de estado manual (recibido → confirmado → preparando → entregado / cancelado).
- **Edición del pedido** (para acuerdos comerciales adicionales):
  - Modificar `precio_unitario` y `cantidad` de cualquier item.
  - Eliminar items y agregar items nuevos (buscador de productos; al agregar, precargar el precio mayorista calculado actual como precio sugerido, editable).
  - Recalcular subtotales y total automáticamente al guardar.
  - La edición no valida contra el monto mínimo (los ajustes manuales son decisión comercial del admin).
  - Solo editable en estados `recibido` y `confirmado`; bloqueado en `preparando`, `entregado` y `cancelado`.
  - Auditoría: al guardar, escribir `modificado_at` (timestamp) y `modificado_por` (nombre del admin autenticado, snapshot de texto). Para cada item editado, escribir `precio_original` **solo si todavía es null** (nunca sobreescribir una vez fijado).
  - En el detalle del pedido del lado mayorista (`/mayoristas/pedido/[id]`), mostrar siempre la versión vigente del pedido (post-edición).

---

## FASE 6 — Contratos de webhooks n8n

Creá `lib/webhooks-mayorista.ts` con tres funciones que hacen POST JSON, con timeout de 10 segundos y manejo de errores (log + no bloquear el flujo del usuario). URLs en env vars. La URL base del sitio sale de la env var `NEXT_PUBLIC_BASE_URL`.

### 1. `N8N_WEBHOOK_SOLICITUD_MAYORISTA`
```json
{
  "evento": "solicitud_mayorista",
  "mayorista_id": 123,
  "nombre": "Juan",
  "apellido": "Pérez",
  "usuario": "juanperez",
  "celular": "5491122334455",
  "email": "juan@mail.com",
  "nombre_local": "Bazar El Sol",
  "ubicacion_local": "Monte Grande, Av. X 123",
  "fecha": "2026-06-12T14:30:00-03:00"
}
```

### 2. `N8N_WEBHOOK_ACTIVACION_MAYORISTA`
```json
{
  "evento": "activacion_mayorista",
  "mayorista_id": 123,
  "nombre": "Juan",
  "apellido": "Pérez",
  "usuario": "juanperez",
  "celular": "5491122334455",
  "email": "juan@mail.com",
  "nombre_local": "Bazar El Sol",
  "vendedor": {
    "nombre": "Facu",
    "celular_wa": "5491199887766",
    "email": "ventas@hefaproductos.com.ar"
  },
  "url_login": "{NEXT_PUBLIC_BASE_URL}/mayoristas",
  "fecha": "2026-06-12T15:00:00-03:00"
}
```

### 3. `N8N_WEBHOOK_PEDIDO_MAYORISTA`
```json
{
  "evento": "pedido_mayorista",
  "pedido_id": 456,
  "mayorista": {
    "id": 123,
    "nombre": "Juan Pérez",
    "nombre_local": "Bazar El Sol",
    "celular": "5491122334455",
    "email": "juan@mail.com",
    "ubicacion_local": "Monte Grande, Av. X 123"
  },
  "vendedor": {
    "nombre": "Facu",
    "celular_wa": "5491199887766",
    "email": "ventas@hefaproductos.com.ar"
  },
  "items": [
    { "producto": "Termo 1L Acero", "cantidad": 12, "precio_unitario": 15900, "subtotal": 190800 }
  ],
  "total": 190800,
  "notas": "Necesito entrega antes del viernes",
  "url_pedido_admin": "{NEXT_PUBLIC_BASE_URL}/admin/mayoristas/pedidos/456",
  "fecha": "2026-06-12T16:45:00-03:00"
}
```

---

## FASE 7 — Seguridad y SEO del canal mayorista

### Indexación

- Agregá en `app/robots.ts` reglas `disallow` para `/mayoristas/catalogo`, `/mayoristas/carrito`, `/mayoristas/pedido`, `/mayoristas/pedidos` y las rutas de API del canal mayorista.
- Agregá `robots: { index: false, follow: false }` en el metadata de todas las páginas detrás del login (catálogo, carrito, pedidos) y de `/mayoristas/login` y `/mayoristas/solicitud`.
- La landing `/mayoristas` SÍ debe ser indexable, con metadata SEO completa (title, description orientados a "venta mayorista bazar hogar electrodomésticos zona sur GBA").
- No incluir ninguna ruta protegida en `app/sitemap.ts`. Incluir `/mayoristas` (la landing) en el sitemap.

### Endurecimiento adicional

- Respuestas de login con mensaje idéntico para "usuario inexistente" y "password incorrecta" (no revelar qué falló). Siempre ejecutar `bcrypt.compare` antes de evaluar el estado, para evitar diferencias de timing.
- Nunca loguear passwords ni hashes.
- JWT con `jose`: payload incluye `mayorista_id` y `estado`. El middleware valida firma y expiración, y revalida contra DB en cada request a rutas protegidas.
- Las rutas de API revalidan `estado = 'activo'` en operaciones sensibles (confirmar pedido).
- Headers en respuestas de páginas protegidas: `Cache-Control: private, no-store` para que ningún CDN o caché intermedio guarde precios mayoristas.

---

## Variables de entorno requeridas

```
MAYORISTA_JWT_SECRET=
NEXT_PUBLIC_BASE_URL=
N8N_WEBHOOK_SOLICITUD_MAYORISTA=
N8N_WEBHOOK_ACTIVACION_MAYORISTA=
N8N_WEBHOOK_PEDIDO_MAYORISTA=
```

---

## Criterios de aceptación

1. Un visitante puede enviar la solicitud y queda en `pendiente`; llega el webhook 1.
2. Un mayorista `pendiente` no puede loguearse; uno `activo` sí; uno `suspendido` no.
3. Aprobar desde el admin exige asignar vendedor y dispara el webhook 2.
4. El catálogo mayorista solo muestra productos con `es_mayorista = true` y stock agregado > 0, con precio calculado server-side según config, respetando overrides y redondeo (ceil).
5. Cambiar el descuento % en el admin cambia los precios del catálogo sin tocar productos.
6. Confirmar un pedido por debajo del monto mínimo es imposible (validación cliente y server).
7. Confirmar un pedido crea registros con snapshot de precios, snapshot de vendedor y dispara el webhook 3.
8. El carrito mayorista no interfiere con el carrito minorista existente.
9. Si un webhook n8n falla, el flujo del usuario no se rompe y el error queda logueado.
10. Las rutas mayoristas protegidas redirigen a `/mayoristas` sin sesión válida.
11. Si un mayorista es suspendido, el middleware detecta el cambio en la próxima request y cierra la sesión (no espera a que expire el JWT de 7 días).
12. El admin puede editar precios y cantidades de un pedido en estado `recibido` o `confirmado`; el total se recalcula; `precio_original` se fija en la primera edición y no se sobreescribe; el mayorista ve la versión vigente.
13. Las rutas protegidas del canal mayorista responden con `noindex` y `Cache-Control: private, no-store`; `robots.ts` las excluye y el sitemap solo incluye la landing `/mayoristas`.
14. El sexto intento de login fallido en 15 minutos (por IP o por usuario) responde 429; la cuarta solicitud de alta desde la misma IP en una hora responde 429; el honeypot descarta bots sin revelar el rechazo.
15. El carrito mayorista persiste en `localStorage` bajo la clave `hefa_carrito_mayorista` y no afecta el carrito minorista.
