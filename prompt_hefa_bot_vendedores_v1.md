# HEFA — Bot de ventas de vendedores por WhatsApp (backend)

Implementá el backend necesario para que un bot de WhatsApp (orquestado desde n8n) permita a los vendedores registrar ventas desde su celular. El bot NO maneja stock directamente: solo crea órdenes y cambia estados, reutilizando la lógica existente de reservas y descuento de stock.

## Contexto del sistema existente (verificalo en el código antes de escribir nada)

- Stack: Next.js App Router (TypeScript) + PostgreSQL en Railway.
- Ya existe un ABM de vendedores con campo de celular. NO crees una tabla de vendedores nueva: inspeccioná el esquema actual y usá la tabla existente.
- Ya existe un sistema de órdenes con estados, donde:
  - Al confirmarse una orden, el stock se RESERVA (no se descuenta).
  - Al pasar la orden a estado "Entregado", el stock se DESCUENTA.
  - La disponibilidad de catálogo = stock físico − reservas activas.
- Ya existe manejo de depósitos y movimientos de stock entre depósitos.

Reutilizá las funciones/servicios existentes de creación de orden, reserva y transición de estado. NO dupliques lógica de stock bajo ninguna circunstancia.

## Migraciones

1. En la tabla de vendedores existente:
   - Si no existe, agregá columna `deposito_id` (FK al depósito asignado al vendedor). Si la relación vendedor→depósito ya existe con otro nombre, usala tal cual.
   - Agregá columna `celular_normalizado` (VARCHAR, único, indexado). Poblala normalizando el campo celular existente a formato E.164 sin el 15 y con 549 adelante (ej: entrada "11 5555-4444" → "5491155554444"). Creá una función utilitaria `normalizarCelular(input: string): string` y usala tanto en la migración como en el ABM al guardar/editar un vendedor, para que la columna se mantenga siempre sincronizada.
   - Agregá columna booleana `bot_habilitado` con default `true`.

2. En la tabla de productos/variantes:
   - Agregá columna `alias_bot` (VARCHAR(40), nullable). Es el nombre corto que ve el vendedor en la lista de WhatsApp. Si es NULL, el nombre a mostrar se arma como: nombre del producto truncado + color/variante, máximo 60 caracteres.
   - Exponé `alias_bot` como campo editable en el ABM de productos existente.

3. Nueva tabla `bot_sesiones` para el estado conversacional del bot (n8n la lee y escribe directo por Postgres):
   ```sql
   CREATE TABLE bot_sesiones (
     celular VARCHAR(20) PRIMARY KEY,
     paso VARCHAR(30) NOT NULL,
     payload JSONB NOT NULL DEFAULT '{}',
     updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   ```

4. En la tabla de órdenes: asegurate de que exista un campo de origen/canal. Si existe, agregá el valor `vendedor` a los permitidos. Si no existe, agregá columna `origen` (VARCHAR) y backfilleá las existentes según corresponda (`web`, `whatsapp`, etc. según lo que ya haya). Agregá también columna `vendedor_id` (FK nullable a vendedores) para atribuir la venta.

## Endpoints

Todos bajo `/api/bot-vendedores/`. Autenticación: header `x-bot-key` que debe coincidir con la variable de entorno `BOT_VENDEDORES_KEY`. Si falta o no coincide, devolvé 401. Agregá `BOT_VENDEDORES_KEY` a `.env.example`.

En todos los endpoints que reciben `celular`: normalizalo con `normalizarCelular`, buscá el vendedor por `celular_normalizado`, y si no existe o `bot_habilitado = false`, devolvé `{ vendedor: null }` con status 200 (n8n decide qué hacer, no es un error).

### 1. `GET /api/bot-vendedores/stock?celular=...`

Devuelve el stock disponible del depósito del vendedor:

```json
{
  "vendedor": { "id": 3, "nombre": "Juan" },
  "items": [
    { "varianteId": 128, "nombre": "Termo autoceb. Luminox 1.2lt negro", "disponible": 3 }
  ]
}
```

- `nombre` = `alias_bot` si existe, si no el nombre armado según la regla de la migración 2.
- `disponible` = stock físico en el depósito del vendedor − reservas activas de ese depósito. Usá el cálculo de disponibilidad existente; no lo reimplementes.
- Excluí ítems con disponible ≤ 0.
- Ordená alfabéticamente por nombre.

### 2. `POST /api/bot-vendedores/orden`

Body:

```json
{
  "celular": "5491155554444",
  "varianteId": 128,
  "cantidad": 1,
  "entregado": true
}
```

Comportamiento:
- Validá que la variante tenga disponible ≥ cantidad en el depósito del vendedor. Si no alcanza, devolvé 409 con `{ "error": "stock_insuficiente", "disponible": N }`.
- Creá una orden usando el servicio existente de creación de órdenes, con: origen `vendedor`, `vendedor_id` del vendedor, el ítem con su cantidad, y el depósito del vendedor como depósito de la orden. Esto debe disparar la reserva automática existente.
- Si `entregado = true`: inmediatamente después, ejecutá la transición de estado existente a "Entregado" (la que descuenta stock).
- Si `entregado = false`: dejá la orden en el estado confirmado/pendiente de entrega que corresponda al flujo existente.
- Respuesta:

```json
{
  "ordenId": 4512,
  "estado": "Entregado",
  "nombre": "Termo autoceb. Luminox 1.2lt negro",
  "cantidad": 1,
  "disponibleRestante": 2
}
```

`disponibleRestante` = disponible del ítem en el depósito del vendedor después de la operación.

### 3. `GET /api/bot-vendedores/pendientes?celular=...`

Devuelve las órdenes del vendedor con origen `vendedor` que NO están en estado "Entregado" ni canceladas:

```json
{
  "vendedor": { "id": 3, "nombre": "Juan" },
  "ordenes": [
    { "ordenId": 4510, "nombre": "Vaso térmico 473ml rosa", "cantidad": 2, "creada": "2026-07-19T14:30:00Z" }
  ]
}
```

Ordenadas de más antigua a más nueva. Si una orden tiene más de un ítem, concatená los nombres con " + ".

### 4. `POST /api/bot-vendedores/entregar`

Body: `{ "celular": "...", "ordenId": 4510 }`

- Validá que la orden exista, pertenezca a ese vendedor y esté en un estado entregable.
- Ejecutá la transición de estado existente a "Entregado" (descuenta stock por la lógica existente).
- Si la orden no es del vendedor o ya está entregada, devolvé 409 con `{ "error": "orden_invalida" }`.
- Respuesta: `{ "ordenId": 4510, "estado": "Entregado" }`.

## Admin

- En el listado de órdenes del admin, mostrá el origen `vendedor` y el nombre del vendedor en las órdenes que lo tengan. Agregá filtro por origen y por vendedor si el listado ya tiene sistema de filtros; si no lo tiene, solo mostrá las columnas.
- No construyas ningún panel nuevo.

## Criterios de aceptación

- `npm run build` pasa sin errores.
- Crear una orden por el endpoint 2 con `entregado=false` genera reserva y la disponibilidad del catálogo baja sin tocar el stock físico.
- Pasar esa orden por el endpoint 4 descuenta el stock físico y libera la reserva.
- Un celular que no corresponde a un vendedor recibe `{ vendedor: null }` en los GET y 401/403 nunca se usa para ese caso.
- El ABM de vendedores sigue funcionando y al editar un celular se actualiza `celular_normalizado`.
