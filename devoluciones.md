# Página de Cambios y Devoluciones — HEFA Productos

Implementá una página de cambios y devoluciones en el sitio existente (Next.js App Router, TypeScript). Antes de escribir código, explorá el proyecto para identificar: la paleta de colores y tipografía actual del sitio, el componente de footer existente, el layout global, y el número de WhatsApp que ya se usa en el sitio (buscalo en componentes existentes, variables de entorno o constantes — usá ese mismo número, no inventes uno).

## Ruta y estructura x

- Crear la página en `app/devoluciones/page.tsx`.
- Debe ser un Server Component. NO uses `'use client'` a nivel de página. Si algún elemento necesita interactividad, extraelo a un componente cliente separado, siguiendo el patrón ya usado en el proyecto (HomePageClient.tsx / ProductPageClient.tsx).
- Agregar metadata exportada para SEO:
  - title: "Cambios y devoluciones | HEFA Productos"
  - description: "Comprá tranquilo en HEFA. Si algo no salió como esperabas, lo resolvemos por WhatsApp: cambios, devoluciones y garantía sin vueltas."
- La página debe quedar incluida en `app/sitemap.ts`.

## Contenido de la página (copy exacto, no modificar)

### Hero

Ícono decorativo cálido (corazón con manos / handshake, usar el set de íconos que ya tenga el proyecto; si no hay ninguno instalado, usar lucide-react).

Título (h1): **Cambios y devoluciones, sin vueltas**

Subtítulo: Comprá tranquilo. Si algo no salió como esperabas, lo resolvemos por WhatsApp, como todo en HEFA.

### Tres tarjetas de escenarios (grid responsive: 3 columnas en desktop, 1 columna en mobile)

Cada tarjeta tiene un ícono con fondo de color suave, un título y un texto breve.

**Tarjeta 1** — ícono de carita neutral, fondo rosa suave:
- Título: Me arrepentí de la compra
- Texto: Puede pasar. Escribinos y coordinamos la devolución. El producto tiene que estar sin uso y con su embalaje original.

**Tarjeta 2** — ícono de paquete, fondo ámbar suave:
- Título: Llegó dañado o no era lo que pedí
- Texto: Escribinos con una foto del producto y del paquete. Lo resolvemos con un reemplazo o la devolución de tu dinero.

**Tarjeta 3** — ícono de herramienta, fondo verde suave:
- Título: Falló con el uso
- Texto: Nuestros productos tienen garantía. Los electrodomésticos además cuentan con garantía oficial de fábrica. Contanos qué pasó y gestionamos el cambio o la reparación.

### Pasos de gestión

Título (h2): **¿Cómo lo gestiono?**

Lista de 3 pasos con círculos numerados:
1. Escribinos por WhatsApp con tu número de pedido
2. Contanos qué pasó (si aplica, mandá una foto)
3. Te acompañamos hasta resolverlo

### CTA principal

Botón grande formato píldora, color verde WhatsApp (#25D366 o el verde que ya use el sitio para WhatsApp), con ícono de WhatsApp y texto: **Iniciar gestión por WhatsApp**

El botón debe abrir `https://wa.me/NUMERO?text=MENSAJE` con este mensaje precargado (URL-encoded): "Hola! Quiero gestionar un cambio o devolución. Mi número de pedido es: "

Usar el número de WhatsApp existente del sitio.

### Sección legal: Botón de arrepentimiento

Al pie de la página, sección separada visualmente (fondo neutro, tipografía más chica) con anchor `id="boton-de-arrepentimiento"`.

Título (h2): **Botón de arrepentimiento**

Texto:

Si compraste a distancia (por la web o por WhatsApp), tenés derecho a arrepentirte de la compra dentro de los 10 días corridos desde que recibiste el producto, sin necesidad de dar motivos, según la Ley 24.240 de Defensa del Consumidor y la Resolución 424/2020.

Condiciones:
- Aplica únicamente a compras realizadas a distancia.
- El producto debe estar sin uso, en las mismas condiciones en que lo recibiste y con su embalaje original.
- La devolución del dinero se realiza por el mismo medio de pago utilizado.

Debajo, botón secundario (estilo outline, menos protagonismo que el CTA de WhatsApp) con texto: **Ejercer botón de arrepentimiento**

Este botón abre `https://wa.me/NUMERO?text=MENSAJE` con este mensaje precargado (URL-encoded): "Hola! Quiero ejercer el botón de arrepentimiento. Mi número de pedido es: "

## Links en el sitio

1. **Footer (todas las páginas)**: agregar dos links al footer existente:
   - "Cambios y devoluciones" → `/devoluciones`
   - "Botón de arrepentimiento" → `/devoluciones#boton-de-arrepentimiento`
2. **Home**: el link "Botón de arrepentimiento" debe ser visible y de acceso directo desde la página de inicio (el footer cumple si está presente en el home; verificá que así sea).

## Diseño

- Respetar la paleta, tipografía y espaciados que ya usa el sitio. La página debe sentirse parte del mismo sitio, no un template ajeno.
- Tono visual cálido: bordes redondeados, fondos suaves en los íconos de las tarjetas, mucho aire entre secciones.
- Mobile-first: la mayoría del tráfico llega desde Meta Ads en celular. Verificar que el CTA de WhatsApp quede visible sin scroll excesivo en mobile.
- Sin emojis: usar íconos del set del proyecto.
- Accesibilidad: contraste AA, alt/aria-label en íconos decorativos, jerarquía correcta de headings (un solo h1).

## Verificación final

- Build sin errores ni warnings de BAILOUT_TO_CLIENT_SIDE_RENDERING.
- La página renderiza contenido en el HTML del servidor (verificar con curl que el copy aparece en el HTML crudo).
- Los dos links de WhatsApp abren con el mensaje precargado correcto.
- Los links del footer funcionan en todas las páginas, incluido el home.
- `/devoluciones` aparece en el sitemap.