# HF WEB - Contexto del Proyecto

## Preferencias de trabajo

- **Cuando el usuario hace una pregunta, está evaluando alternativas — NO implementar nada.** Responder con una explicación de opciones, pros/contras, o aclaraciones. Solo implementar cuando el usuario lo pide explícitamente.

## Arquitectura

---

## Sesión 2026-03-23

### Stock qty en API pública

- `ProductPublicResponse` ahora incluye `stock_qty: Optional[int]` (calculado en backend como suma de compras minus salidas).
- `ProductPublic` en tipos TS también incluye `stock_qty?: number | null`.
- Permite que el front tome decisiones basadas en stock real sin llamadas adicionales.

### Componente StockAvailability

- Nuevo: `frontend/src/components/public/StockAvailability.tsx`
- Expone `resolveStockLevel(isCheckStock, isImmediateDelivery, stockQty?, lowStockThreshold?)` → `'high' | 'low' | 'none'`
  - `high`: qty > umbral, o is_immediate_delivery, o sin dato y sin is_check_stock
  - `low`: 0 < qty <= umbral
  - `none`: qty === 0, o is_check_stock sin inmediata
- Botón WhatsApp con mensaje contextual según nivel de stock
- Props: `stockQty`, `isCheckStock`, `isImmediateDelivery`, `lowStockThreshold`, `productName/Slug/Price`, `whatsappNumber`

### Umbral global de stock bajo (stock_low_threshold)

- Backend: `app_settings.py` — clave `STOCK_LOW_THRESHOLD` en BD, default `5`
- `GET /settings/catalog` y `GET /public/catalog-settings` ahora incluyen `stock_low_threshold: int`
- `PATCH /settings/catalog` acepta `stock_low_threshold: Optional[int]`
- **Configuración movida**: el control de umbral global se removió de `/admin/categorias` y se agregó a `/admin/configuracion` (página de Configuración IA)

### Umbral por producto (stock_low_threshold individual)

- Migración `037_add_stock_low_threshold.py`: columna `stock_low_threshold` en tabla `products` (nullable, override del global)
- `ProductUpdateForm` en tipos TS incluye `stock_low_threshold?: number | null`

### Regla: no asignar entrega inmediata sin stock

- En `admin/productos/[id]/page.tsx`: toggle de "Entrega inmediata" deshabilitado (cursor-not-allowed, opacity-50) si `stock_qty === 0`
- Mensaje: "No disponible — stock en 0"

### Regla: no agregar a sección sin stock

- En `admin/secciones/page.tsx`: al buscar productos para asignar a una sección manual, los sin stock aparecen con opacity-60 y el botón "Agregar" deshabilitado
- Modal de gestión de productos ahora es `size="xl"` con imagen 64×64
- Se muestra "Stock: N" en verde o "Sin stock" en gris

### Vista ventas mejorada

- En `admin/ventas/page.tsx`: lista de productos del carrusel muestra estado de stock con color (emerald si hay, gris si no)
- Botón cambia a "Agregar igual" con estilo ghost/dashed cuando stock = 0

---

## Sesión 2026-03-19/20/21

### PublicHeader — componente extraído

- Nuevo componente: `frontend/src/components/public/PublicHeader.tsx`
- Contiene todo el header sticky + subheader (antes estaba inline en `page.tsx`)
- Se usa en `page.tsx` y en `producto/[slug]/page.tsx`
- Header: logo HE·FA, botón "¿Cómo funciona?", botón WhatsApp (desktop)
- Barra de búsqueda con debounce de **300ms** (antes 900ms)
- Subheader sticky (`top-[104px]`) con pills: Filtros (hamburger), Ver todo, Novedades, Inmediata, categorías, subcategorías
- Dropdown hamburger con drill-down: categorías → subcategorías
- `updateParams` navega con `router.replace` en home y `router.push` desde otras páginas

### Carrusel de categorías

**Backend (campos nuevos en `Category`):**
- Migración `030_add_carousel_fields_to_categories.py`: `carousel_title`, `carousel_subtitle`, `carousel_image_url`, `carousel_bg_color`, `carousel_text_color`, `carousel_font`, `carousel_filter_type`
- Migración `031_carousel_filter_type.py`: campo `carousel_filter_type`
- Migración `032_carousel_glow.py`: campos `carousel_glow` (bool), `carousel_glow_color`
- Campo `show_in_carousel` (bool) en `Category`
- `carousel_filter_type` puede ser `null` (filtra por nombre), `featured` o `immediate_delivery`

**Frontend:**
- Componente `CategoryCarousel` en `page.tsx` (inline)
- Auto-scroll infinito (duplica slides, resetea `scrollLeft` al llegar a la mitad)
- Pausa al hover/touch
- Soporta imagen de fondo, efecto glow, fuente configurable
- Solo se muestra cuando no hay filtro de categoría/featured/immediate activo

### Módulo Secciones

**Backend:**
- Migraciones:
  - `033_add_sections.py`: tablas `sections` y `section_products`
  - `034_section_image_url.py`: campo `image_url` en `Section`
  - `035_section_products_updated_at.py`: `updated_at` en sección
  - `036_section_position.py`: campo `position` (`arriba` / `abajo`)
- Modelo `Section`: `id`, `title`, `subtitle`, `display_order`, `is_active`, `criteria_type`, `criteria_value`, `max_products`, `bg_color`, `text_color`, `image_url`, `position`
- `criteria_type`: `manual`, `featured`, `immediate_delivery`, `category`, `best_seller`
- Endpoint: `backend/app/api/v1/endpoints/sections.py`
  - `GET /public/sections` — devuelve secciones activas con sus productos resueltos
  - CRUD admin para secciones

**Frontend:**
- Admin: `frontend/src/app/admin/secciones/page.tsx` — CRUD de secciones
- Componente público: `frontend/src/components/public/SectionCard.tsx`
  - Tarjeta 300px de ancho, altura completa del contenedor
  - Imagen centrada en la parte inferior de la card
  - Título + subtítulo en la parte superior
  - Borde izquierdo de acento (`4px solid textColor40`)
- Componente: `frontend/src/components/public/SectionStrip.tsx` (usado en detalle de producto)
- Datos: `publicApi.getSections()` con `queryKey: ['public-sections']`

**Lógica en `page.tsx`:**
- `sectionsArriba` y `sectionsAbajo` (filtradas por `position`)
- Se muestran en containers `h-[280px] sm:h-[400px] lg:h-[440px]`, scroll horizontal
- `section_id` en URL para activar filtro de sección manual
- Al seleccionar sección: `handleSectionSelect` mapea `criteria_type` a los params de URL
- Banner en grid muestra nombre de sección activa + botón "× Ver todo"
- Scroll automático al grid al activar filtro de sección (`productGridRef`)

### Cambios visuales en `page.tsx`

- `accentColor`: gradiente de fondo que cambia con el filtro activo (color de categoría, amber para featured, emerald para inmediata)
- Vista por defecto: productos agrupados por categoría (`groupedByCategory`) con separadores de color
- `showGroupedByCategory`: true solo cuando no hay categoría/featured/immediate/section_id activo
- Footer con columnas: marca, contacto, información

### Cambios en `globals.css`

- `animate-attention-pulse`: animación de pulso/glow para pills de categorías al cargar
- `animate-glow-pulse`: para tarjetas de carrusel con glow activado
- Fondo `body` cambiado a `#f7f4ef` (crema)

---

## Estado actual del menú admin (2026-03-06)

`frontend/src/app/admin/layout.tsx` — estructura con submenús por grupo:

| Ítem | Ruta | Notas |
|------|------|-------|
| **Dashboard** | `/admin` | Top level. Resumen financiero aparece primero |
| **Productos** (submenu) | | |
| → Productos | `/admin/productos` | |
| → Compras | `/admin/stock/compras` | |
| → Stock | `/admin/stock/resumen` | |
| → Stock sin match | `/admin/stock` | |
| → Comparador | `/admin/comparador` | |
| → Descripciones IA | `/admin/ai-descripciones` | |
| **Ventas** (submenu) | | |
| → Ventas | `/admin/ventas` | |
| → Pedidos | `/admin/pedidos` | |
| → WhatsApp | `/admin/whatsapp` | |
| **Analítica** (submenu) | | |
| → Movimientos | `/admin/analytics` | |
| → Ranking Clientes | `/admin/clientes-ranking` | |
| **Configuracion** (submenu) | | |
| → Categorias | `/admin/categorias` | |
| → Subcategorias | `/admin/subcategorias` | |
| → Webs Origen | `/admin/source-websites` | |
| → Configuracion IA | `/admin/configuracion` | |

---

## Sesion 2026-02-23

### Estado real verificado en codigo

**Frontend publico (`frontend/src/app/page.tsx`):**
- Header tipo banner con texto: `HE-FA` y `Productos para el hogar`.
- Banner informativo "Primera vez comprando..." activo con modal (`HowWeWorkModal`).
- Busqueda con debounce de `900ms` (no dispara por cada tecla inmediatamente).
- Tracking de busqueda solo si termino >= 3 caracteres y evitando duplicados consecutivos.
- Tracking activo de eventos: `page_view`, `search`, `category_click`, `subcategory_click`, `whatsapp_click`.
- Ajuste de espaciado vertical aplicado para reducir aire entre header, banner y busqueda:
  - header container `py-2`
  - wrapper del banner `py-1.5`
  - boton del banner `py-2`
  - main container `py-3`
  - bloque de busqueda/filtros `mb-4 space-y-3`

**Reglas de categorias/subcategorias en front publico (backend):**
- `get_public_categories()` (`backend/app/services/product.py`) solo devuelve categorias:
  - activas (`Category.is_active = true`)
  - con productos habilitados (`Product.enabled = true`)
- `get_public_subcategories()` solo devuelve subcategorias:
  - activas y con categoria activa
  - con al menos 1 producto habilitado en esa categoria/subcategoria
- Resultado practico: no se muestran categorias inhabilitadas ni categorias/subcategorias vacias.

**Analitica publica:**
- Evento anonimo publico en `POST /public/events` (`backend/app/api/v1/endpoints/public.py`).
- Tabla/modelo de eventos: `analytics_events` (`backend/app/models/analytics_event.py`), migracion `026_create_analytics_events.py`.
- Resumen admin disponible en `GET /admin/stats/public-analytics` (`backend/app/api/v1/endpoints/admin.py` + `backend/app/services/product.py`).
- Vista admin: `frontend/src/app/admin/analytics/page.tsx`
  - boton `Actualizar` (refetch manual)
  - metrica CTR a producto y CTR a WhatsApp
  - top productos por `product_name` (no solo slug/codigo)

**Ventas y dashboard admin (estado visible hoy):**
- Vista ventas (`frontend/src/app/admin/ventas/page.tsx`) muestra tarjeta de `Valorizado vendido` en resumen general y filtrado.
- Vista dashboard (`frontend/src/app/admin/page.tsx`) organizada en 3 bloques:
  - `Inversion + Stock`
  - `Ventas y Estadios`
  - `Proyecciones Ventas + Stock` (escenarios costo/+50%/+70% vs inversion)

## Sesion 2026-02-09 (cont.)

### Nuevo Campo: is_best_seller (Lo mas vendido)

**Backend:**
- Migracion: `backend/alembic/versions/015_add_is_best_seller.py`
- Modelo actualizado: `backend/app/models/product.py` - campo `is_best_seller`
- Schemas actualizados: `backend/app/schemas/product.py` - ProductRemoveBadge
- Servicio: `backend/app/services/product.py`:
  - `bulk_remove_badge(product_ids, badge_field)` - quitar badges masivamente
  - `calculate_best_sellers(threshold)` - marca automatica segun ventas

**Frontend:**
- Filtro "Mas Vendido" en pagina de productos (purpura)
- Badge visual en tabla de productos

### Acciones Masivas para Badges

**Endpoints:**
- `POST /admin/products/remove-badge` - quita badge de productos
- `POST /admin/products/calculate-best-sellers?threshold=5` - calcula mas vendidos

**Frontend (productos):**
- Botones en barra de seleccion: Quitar Nuevo, Quitar Inmediata, Quitar Top
- Dropdown Acciones: Calcular mas vendidos, Quitar todos (x3)

### Generador de Mensajes WhatsApp

**Backend:**
- Servicio: `backend/app/services/whatsapp_generator.py`
- Schemas: `backend/app/schemas/whatsapp.py`
- Endpoints:
  - `POST /admin/whatsapp/filter-products` - filtra productos por badges
  - `POST /admin/whatsapp/generate-messages` - genera mensajes individuales
  - `POST /admin/whatsapp/generate-bulk-message` - genera mensaje combinado

**Frontend:**
- Nueva pagina: `frontend/src/app/admin/whatsapp/page.tsx`
- Menu actualizado: `frontend/src/app/admin/layout.tsx`

**Templates disponibles:**
- `default`: Estandar con badges
- `nuevos`: "NUEVO EN CATALOGO"
- `mas_vendidos`: "LO MAS VENDIDO"
- `promo`: Promocional
- `custom`: Texto personalizado con placeholders

**Flujo:**
1. Filtrar productos por badges
2. Seleccionar productos
3. Elegir template y opciones
4. Generar mensajes (individual o combinado)
5. Copiar texto + descargar imagenes
6. Publicar manualmente en canal WhatsApp

### Fix: Constraint de duplicados en stock

- Migracion: `backend/alembic/versions/014_remove_stock_dedupe_constraint.py`
- Elimina `uq_stock_purchases_dedupe` para permitir re-asociaciones
- Modelo actualizado: `backend/app/models/stock.py`

### Fix: Endpoint de asociacion stock

- `backend/app/api/v1/endpoints/admin.py` - PATCH /stock/purchases/{id}
- Eliminada validacion de duplicados al asociar manualmente

### Variables de Entorno (CORS)

```
ALLOWED_ORIGINS_STR=https://grand-passion-production.up.railway.app,https://www.hefaproductos.com.ar,https://hefaproductos.com.ar
```

---

## SesiÃƒÂ³n 2026-02-08/09

### MÃƒÂ³dulo Stock (compras y asociaciÃƒÂ³n)

**Backend:**
- Modelo `StockPurchase` con `out_quantity` (salidas) y `product_id` nullable.
- Migraciones:
  - `backend/alembic/versions/011_add_stock_purchases.py`
  - `backend/alembic/versions/012_make_stock_purchase_product_nullable.py`
- Servicio `backend/app/services/product.py`:
  - `preview_stock_csv` y `import_stock_csv` (CSV: producto, cÃƒÂ³digo, precio, cantidad, total, fecha)
  - `get_stock_purchases`, `update_stock_purchase`, `find_duplicate_stock_purchase`
  - `get_stock_stats_by_category`
- Endpoints:
  - `POST /admin/stock/preview`
  - `POST /admin/stock/import`
  - `GET /admin/stock/purchases?product_id=&unmatched=`
  - `PATCH /admin/stock/purchases/{id}` (asociar/desasociar)
  - `GET /admin/stats/stock-by-category`
  - `GET /admin/stats/financials`

**Frontend:**
- `frontend/src/app/admin/stock/page.tsx`:
  - Lista de compras sin match + buscador de productos
  - AsociaciÃƒÂ³n a producto existente
  - BotÃƒÂ³n "Crear producto manual" con datos precargados de la compra
  - Modal de compra duplicada (409)
  - Manejo de errores sin "Uncaught"
- `frontend/src/app/admin/productos/[id]/page.tsx`:
  - Flechas anterior/siguiente (lista guardada en sessionStorage desde `admin/productos`)
  - SecciÃƒÂ³n stock por compras en ancho completo
  - BotÃƒÂ³n "Desasociar" por compra
- `frontend/src/app/admin/productos/page.tsx`:
  - Guarda lista de IDs en sessionStorage para navegaciÃƒÂ³n en detalle
- `frontend/src/app/admin/page.tsx`:
  - Card de stock por categorÃƒÂ­a
  - Resumen financiero (total comprado, cobrado, pendientes y stock a costo)

### Reglas de CSV y asociaciÃƒÂ³n
- Columnas: descripciÃƒÂ³n y cÃƒÂ³digo son separadas.
- Si cÃƒÂ³digo vacÃƒÂ­o: se deriva de los 5 dÃƒÂ­gitos izquierdos de la descripciÃƒÂ³n.
- CÃƒÂ³digo es ÃƒÂºnico (pero se quitÃƒÂ³ validaciÃƒÂ³n estricta al asociar).
- Fecha en formato `DD/MM/YYYY`.
- La marca "Entrega inmediata" se define en la carga de stock.
- Existe campo de salida (OUT) para stock, a mejorar mÃƒÂ¡s adelante.

### Ventas (Sales)

**Backend:**
- Modelos: `backend/app/models/sale.py` y migraciÃƒÂ³n `013_create_sales.py`
- Schemas: `backend/app/schemas/sales.py`
- Service: `backend/app/services/sales.py`
  - Descuenta stock al marcar `delivered = true` (FIFO)
  - ReversiÃƒÂ³n de stock al borrar venta entregada (LIFO)
- Endpoints:
  - `POST /admin/sales`
  - `GET /admin/sales`
  - `GET /admin/sales/{id}`
  - `PATCH /admin/sales/{id}` (delivered/paid)
  - `DELETE /admin/sales/{id}` (revierte stock si entregada)

**Frontend:**
- `frontend/src/app/admin/ventas/page.tsx`:
  - Stock en venta, carrito, cantidad, precio editable
  - Campos: cliente, notas, cuotas, vendedor (Facu/Heber), Entregado, Pagado
  - SecciÃƒÂ³n "Ventas existentes" con toggle Entregado/Pagado
  - Link a detalle de venta
- `frontend/src/app/admin/ventas/[id]/page.tsx`:
  - Vista completa de venta (items, totales, estado, notas)
  - BotÃƒÂ³n eliminar venta con reversiÃƒÂ³n de stock

### Otros fixes recientes
- `backend/app/api/v1/endpoints/admin.py`:
  - Errores 409 de duplicados ahora serializados con `jsonable_encoder` (evita crash por date/Decimal)
- `frontend/src/lib/utils.ts`: `formatPercentage` tolera string
- `frontend/src/app/producto/[slug]/page.tsx`: `short_description` respeta saltos de lÃƒÂ­nea
- `frontend/src/components/admin/ActivateInactiveModal.tsx`: markup=0 permitido

### Backend (Python/FastAPI)
- **URL Producción:** https://hf-web-production.up.railway.app
- **Deploy:** Railway con Nixpacks + Procfile
- **Base de datos:** PostgreSQL en Railway
- **Comando inicio:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Frontend (Next.js)
- **URL Producción:** https://grand-passion-production.up.railway.app
- **Deploy:** Railway con Nixpacks
- **API URL:** https://hf-web-production.up.railway.app/api/v1

### Base de Datos
- **Host interno:** postgres.railway.internal:5432
- **Host público:** caboose.proxy.rlwy.net:34030
- **Database:** railway
- **User:** postgres

## Variables de Entorno

### Backend (Railway)
```
DATABASE_URL=postgresql://postgres:***@postgres.railway.internal:5432/railway
ALLOWED_ORIGINS_STR=https://grand-passion-production.up.railway.app
ENVIRONMENT=production
ADMIN_API_KEY=***
SECRET_KEY=***
```

### Frontend (Railway)
```
NEXT_PUBLIC_API_URL=https://hf-web-production.up.railway.app/api/v1
NEXT_PUBLIC_WHATSAPP_NUMBER=549XXXXXXXXXX
NEXT_PUBLIC_SITE_NAME=HeFa - Productos
NEXT_PUBLIC_SITE_DESCRIPTION=Catalogo de productos
# Opcional: si no se setea, se usa window.location.origin
NEXT_PUBLIC_SITE_URL=https://tu-dominio.com
```

## Configuración Local

### Backend
- Puerto: 8000
- DB: catalog_db en localhost:5432

### Frontend
- Puerto: 3000
- API: http://localhost:8000/api/v1

## Problemas Resueltos

1. **CORS:** Configurado `ALLOWED_ORIGINS_STR` para parsear desde env var
2. **Dockerfile vs Nixpacks:** Railway funciona mejor con Nixpacks + Procfile
3. **Puerto dinámico:** Usar `$PORT` en Procfile para Railway
4. **Galería de imágenes:** Agregado estado para cambiar imagen seleccionada

## Features Pendientes

### Integración WhatsApp para crear productos
**Objetivo:** Conectar a un canal de WhatsApp, leer mensajes y crear productos automáticamente.

**Preguntas pendientes:**
- Tipo de cuenta WhatsApp (Business API, normal, canal)
- Formato de mensajes (foto + texto?)
- Datos a extraer (nombre, precio, imagen, descripción)
- Quién envía los mensajes (proveedores, manual)

**Opciones técnicas:**
| Opción | Costo | Complejidad |
|--------|-------|-------------|
| WhatsApp Business API (oficial) | ~$0.05/mensaje | Alta |
| Twilio para WhatsApp | ~$0.005/mensaje | Media |
| Baileys (no oficial, gratis) | Gratis | Media-Alta (riesgo de ban) |

## Comandos Útiles

### Migrar datos local → producción
```powershell
# Exportar local
cd "D:\Desarrollo\HF WEB\backend"
$env:PGPASSWORD="Diezdias2!"
& "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -h localhost -U postgres -d catalog_db --data-only -F c -f backup.dump

# Importar a Railway
$env:PGPASSWORD="[PASSWORD_RAILWAY]"
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -h caboose.proxy.rlwy.net -p 34030 -U postgres -d railway backup.dump
```

### Limpiar caché frontend
```powershell
cd "D:\Desarrollo\HF WEB\frontend"
rm -rf .next
npm run dev
```

---

## Sesión 2026-02-02

### Features Implementados

#### 1. Botón "Consultar Stock Masivo" en Webs de Origen
- **Archivo:** `frontend/src/app/admin/source-websites/page.tsx`
- **Endpoint:** `POST /admin/source-websites/{id}/check-stock-all`
- **Función:** Marca todos los productos activos de una fuente como "Consultar stock" (quita badges "Nuevo" y "Entrega inmediata")

#### 2. Menú Hamburguesa para Móvil (Frontend Público)
- **Archivo:** `frontend/src/app/page.tsx`
- Botón hamburguesa (☰) al lado de búsqueda que despliega menú de categorías
- Píldoras de filtro activo:
  - **Categoría:** azul (`bg-blue-600`)
  - **Nuevo:** naranja (`bg-orange-500`)
  - **Entrega inmediata:** verde (`bg-green-600`)
- Estados visuales claros: activo (fondo sólido + sombra) vs inactivo (fondo blanco + borde)
- La píldora de categoría se oculta cuando "Nuevo" o "Inmediata" están activos
- Atributos ARIA para accesibilidad

#### 3. Eliminación de Paginación
- **Archivo:** `frontend/src/app/page.tsx`
- Se carga hasta 1000 productos de una vez
- **Archivo:** `backend/app/api/v1/endpoints/public.py`
- Límite máximo aumentado de 100 a 1000 (`le=1000`)

### Scraper DecoModa

#### Ubicación
- **Scraper:** `backend/app/scrapers/decomoda.py`
- **Registro:** Importado en `backend/app/main.py`
- **Seed data:** Entrada en `backend/scripts/seed_data.py`
- **Imágenes:** `bunny-cdn.ventasxmayor.com` agregado a `frontend/next.config.js`

#### Configuración
- **Identificador fuente:** `decomoda` (sin guión)
- **URL Base:** `https://decomoda-mayorista.com.ar`
- **Sin autenticación**

#### Evolución del Scraper
1. **Intento 1 - Página principal:** Fallaba porque carga productos con JavaScript
2. **Intento 2 - Sitemap.xml:** Tiene 677 URLs pero muchas son 404 (enlaces muertos) - ~113 productos
3. **Intento 3 - Categoría "TODOS NUESTROS PRODUCTOS":** Tiene 462 productos PERO usa JavaScript
4. **Solución final - Playwright:** Renderiza JavaScript para obtener los 462 productos

#### Configuración Playwright en Railway
- **Archivo:** `backend/nixpacks.toml`
- Instala chromium y ffmpeg via Nix
- Ejecuta `playwright install chromium` en build

#### Código Final
```python
class DecoModaScraper(BaseScraper):
    BASE_URL = "https://decomoda-mayorista.com.ar"
    ALL_PRODUCTS_URL = f"{BASE_URL}/categoria/66137823529174453"
    SITEMAP_URL = f"{BASE_URL}/sitemap.xml"  # Fallback

    # Usa Playwright para renderizar JavaScript y obtener 462 productos
    # Fallback a sitemap si Playwright no disponible (~113 productos)
    # JSON-LD schema para datos de cada producto
```

#### Problemas resueltos en extracción de datos
- **Dos schemas JSON-LD:** Organization (genérico) y Product (correcto). El código busca `@type == 'Product'`
- **Logo mezclado con imágenes:** Filtrado con `'logo' not in img.lower()`
- **Descripción genérica del sitio:** Filtrada si contiene "DISTRIBUIDORA MAYORISTA DECOMODA"

### IMPORTANTE: Slugs sin nombre de mayorista
Los slugs de productos NO deben revelar el origen mayorista:
- ❌ `decomoda-12748` → ✅ `prod-12748`
- ❌ `redlenic-ABC123` → ✅ `prod-ABC123`
- newredmayorista usa slugs de nombre de producto (OK)

**Archivos corregidos:**
- `backend/app/scrapers/decomoda.py`: `prod-{sku}` o `prod-dm-{id}`
- `backend/app/scrapers/redlenic.py`: `prod-{sku}` o `{nombre}-{idx}`

### ABM de Categorías (2026-02-02)

**Backend:**
- `backend/app/models/category.py` - Modelo Category
- `backend/app/schemas/category.py` - Schemas
- `backend/app/api/v1/endpoints/categories.py` - CRUD endpoints
- `backend/alembic/versions/006_add_categories_table.py` - Migración (crea tabla + popula con categorías existentes)

**Frontend:**
- `frontend/src/app/admin/categorias/page.tsx` - ABM UI
- `frontend/src/types/index.ts` - Category type
- `frontend/src/app/admin/layout.tsx` - Link en navegación

**Endpoints:**
- `GET /categories` - Listar (público)
- `POST /categories` - Crear (admin)
- `PATCH /categories/{id}` - Actualizar (admin) - también actualiza productos
- `DELETE /categories/{id}` - Eliminar (admin) - productos quedan sin categoría

### Debugging DecoModa Scraper

Si el scraper trae pocos productos, revisar logs para ver:
- `[DecoModa] Playwright disponible...` o `Playwright NO disponible...`
- Si usa sitemap fallback, muchos productos serán 404

Si no trae imágenes, revisar:
- El schema JSON-LD debe tener `"image": ["url..."]`
- Las imágenes se filtran si contienen "logo" en la URL

### Navegación Admin Reorganizada

El menú lateral del admin ahora tiene estructura jerárquica:
- **Dashboard** - `/admin`
- **Productos** - `/admin/productos`
- **Configuración** (collapsible)
  - Categorías - `/admin/categorias`
  - Webs Origen - `/admin/source-websites`

**Archivo:** `frontend/src/app/admin/layout.tsx`
- Estado `configOpen` para expandir/colapsar
- Auto-expande si el usuario está en una página de configuración
- Iconos ChevronDown/ChevronRight para indicar estado
- Mobile: todas las opciones visibles como píldoras horizontales

### Archivos Modificados Hoy

| Archivo | Cambio |
|---------|--------|
| `frontend/src/app/page.tsx` | Menú hamburguesa móvil, píldoras de filtros, quitar paginación |
| `frontend/src/app/admin/source-websites/page.tsx` | Botón "Consultar Stock" masivo |
| `frontend/src/app/admin/layout.tsx` | Navegación con submenú "Configuración" colapsable |
| `backend/app/api/v1/endpoints/public.py` | Límite de productos 100→1000 |
| `backend/app/scrapers/decomoda.py` | Scraper con Playwright + fallback sitemap |
| `backend/requirements.txt` | Agregado playwright>=1.40.0 |
| `backend/nixpacks.toml` | **NUEVO** - Config para instalar Playwright en Railway |

### Notas Importantes

- **Crear fuente decomoda:** Desde admin → Webs de Origen → Agregar Web con identificador `decomoda`
- **Re-scrapear:** Después del deploy, borrar productos existentes de decomoda y volver a scrapear para obtener los 462 productos

---

## Sesión 2026-02-03

### Features Implementados

#### 1. Comparador de Precios (Nueva página)
- **Archivo:** `frontend/src/app/admin/comparador/page.tsx`
- **Endpoint:** `GET /admin/price-comparator?search=...`
- **Backend:** `backend/app/api/v1/endpoints/admin.py`
- Busca productos por palabra clave y agrupa por nombre similar
- Muestra precio mínimo (verde) y máximo (rojo) entre fuentes
- Calcula diferencia porcentual entre precios
- Grupos expandibles con detalle de cada fuente
- Separa productos "comparables" (varias fuentes) de "solo una fuente"

#### 2. Dashboard Mejorado con Estadísticas
- **Archivo:** `frontend/src/app/admin/page.tsx`
- **Endpoint:** `GET /admin/stats/by-source-category`
- **Backend:** `backend/app/services/product.py`

**Cards de métricas:**
- Total productos
- Habilitados
- Deshabilitados
- Con datos de mercado

**Tabla de estadísticas:**
- Filas: Webs de origen
- Columnas: Categorías
- Celdas: habilitados/total

**Gráfico de barras apiladas:**
- Usa **Recharts** (`recharts` en package.json)
- Muestra productos activos por fuente, coloreados por categoría

#### 3. Filtros Persistentes en Admin (Zustand)
- **Hook:** `frontend/src/hooks/useAdminFilters.ts`
- **Librería:** Zustand con middleware `persist`
- Guarda en localStorage: búsqueda, enabled, source, categoría, featured, página, límite
- Los filtros persisten al navegar entre páginas

```typescript
// Uso en componentes
const { search, setSearch, enabledFilter, setEnabledFilter } = useAdminFilters();
```

#### 4. Categorías: Campos Color y Show In Menu
- **Migración:** `backend/alembic/versions/007_add_category_color_and_menu.py`
- **Campos nuevos:**
  - `color` (VARCHAR 7) - Hex color, default `#6b7280`
  - `show_in_menu` (BOOLEAN) - Default `false`

**ABM actualizado:**
- Selector de colores predefinidos (9 colores)
- Color picker personalizado
- Checkbox "Mostrar en menú mobile"

**Colores predefinidos:**
```javascript
['#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899']
```

#### 5. Efecto Llamativo para Categorías Destacadas
- **Archivo:** `frontend/src/app/globals.css`
- **Clase:** `animate-attention-pulse`
- Animación CSS que pulsa escala + sombra al cargar
- Se aplica a categorías con `show_in_menu: true` en el menú móvil

```css
@keyframes attention-pulse {
  0% { transform: scale(1); box-shadow: 0 0 0 0 currentColor; }
  10% { transform: scale(1.15); box-shadow: 0 0 20px 4px currentColor; }
  /* ... pulsos decrecientes ... */
  100% { transform: scale(1); box-shadow: 0 0 0 0 transparent; }
}
```

#### 6. Precio en Mensaje de WhatsApp
- **Archivos:**
  - `frontend/src/components/public/ContactButton.tsx`
  - `frontend/src/app/producto/[slug]/page.tsx`
- El botón de contacto ahora incluye el precio formateado en el mensaje

### Navegación Admin Actualizada

```
/admin
├── Dashboard (con stats y gráficos)
├── Productos
├── Comparador (NUEVO)
└── Configuración
    ├── Categorías (con color y show_in_menu)
    └── Webs Origen
```

**Archivo:** `frontend/src/app/admin/layout.tsx` - Agregado link a Comparador

### Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/app/admin/page.tsx` | Dashboard con stats, tabla y gráfico Recharts |
| `frontend/src/app/admin/comparador/page.tsx` | **NUEVO** - Comparador de precios |
| `frontend/src/app/admin/categorias/page.tsx` | Color picker y show_in_menu |
| `frontend/src/app/admin/productos/page.tsx` | Usa hook useAdminFilters |
| `frontend/src/app/admin/layout.tsx` | Link a comparador |
| `frontend/src/hooks/useAdminFilters.ts` | **NUEVO** - Zustand persist para filtros |
| `frontend/src/app/globals.css` | Animación attention-pulse |
| `frontend/src/app/page.tsx` | Categorías con color y animación |
| `frontend/src/components/public/ContactButton.tsx` | Precio en mensaje WA |
| `frontend/src/types/index.ts` | Category con color y show_in_menu |
| `backend/alembic/versions/007_...` | **NUEVO** - Migración color y show_in_menu |
| `backend/app/api/v1/endpoints/admin.py` | Endpoints stats y comparador |
| `backend/app/api/v1/endpoints/categories.py` | Soporta nuevos campos |
| `backend/app/schemas/category.py` | color y show_in_menu |
| `backend/app/models/category.py` | Columnas color y show_in_menu |
| `backend/app/services/product.py` | Lógica stats by source/category |
| `backend/app/db/repositories/product.py` | Filtro "Sin categoría" corregido |
| `backend/requirements.txt` | (sin cambios nuevos) |

### Correcciones de Compilación

- `frontend/src/components/admin/ActivateInactiveModal.tsx` - Fix tipos
- `frontend/src/components/admin/ChangeCategoryModal.tsx` - Fix tipos
- `backend/.python-version` - Ajuste versión Python
- `backend/nixpacks.toml` - Config para Railway

---

## Sesión 2026-02-04

### IMPORTANTE: Configuración Automática de Scrapers

Los nuevos scrapers se configuran **automáticamente** en el deploy:

1. **Migraciones**: Se corren automáticamente (`alembic upgrade head`) en la fase build de nixpacks
2. **Fuentes (Source Websites)**: Se crean automáticamente via `seed_data.py`

**Archivo clave:** `backend/scripts/seed_data.py`
- Contiene todas las fuentes con sus credenciales y configuración
- Se ejecuta en cada deploy, crea las fuentes si no existen
- **Para agregar un nuevo scraper**: agregar entrada en `seed_data.py` + crear el scraper + importar en `main.py`

**Archivo:** `backend/nixpacks.toml` (fase build)
```toml
[phases.build]
cmds = [
    "alembic upgrade head",
    "python -m scripts.seed_data"
]
```

### Nuevos Campos en Modelo Product

- **Migración:** `backend/alembic/versions/008_add_min_purchase_qty_and_kit_content.py`
- **Campos:**
  - `min_purchase_qty` (Integer, nullable) - Cantidad mínima de compra
  - `kit_content` (Text, nullable) - Contenido del kit/combo

### Scraper Sina (API REST)

| Campo | Valor |
|-------|-------|
| **Identificador** | `sina` |
| **URL Base** | `https://www.sina.com.ar` |
| **API Base** | `https://apisina-v1.leren.com.ar` |
| **Requiere auth** | Sí (JWT token) |
| **Usa Playwright** | **NO** (usa API REST directamente) |
| **Archivo** | `backend/app/scrapers/sina.py` |

**Credenciales (variables de entorno):**
```
SINA_USERNAME=diezjuarez22@gmail.com
SINA_PASSWORD=Hermanos1997!
```

**API Endpoints:**
- `POST /auth/login` - Login con email/password, devuelve JWT token
- `GET /producto/categoriapadre/{categoria}` - Productos por categoría

**Categorías conocidas:**
```python
CATEGORIES = [
    "Limpieza", "Descartables", "Bazar", "Perfumeria", "Alimentos",
    "Ferreteria", "Indumentaria", "Libreria", "Jugueteria", "Electronica",
    "Hogar", "Jardin", "Mascotas", "Automotor", "Textil",
]
```

**Headers requeridos:**
```python
headers = {
    "x-api-token": token,  # JWT token del login
    "Origin": "https://www.sina.com.ar",
    "Referer": "https://www.sina.com.ar/",
}
```

**Características:**
- Extrae campos adicionales: `min_purchase_qty`, `kit_content`, `sku`
- No usa browser, todo via httpx/requests
- Itera por categorías para obtener todos los productos
- Rate limit: 0.5s entre requests (API es rápida)

**Historia:** Inicialmente se intentó usar Playwright para el Angular SPA, pero hubo problemas con Railway (chromium no disponible, timeouts con Browserless.io). Se descubrió la API REST inspeccionando las llamadas de red del frontend.

### Scraper Protrade

| Campo | Valor |
|-------|-------|
| **Identificador** | `protrade` |
| **URL Base** | `https://www.protrade.com.ar` |
| **Requiere auth** | No (o password si es necesario) |
| **Estructura** | Idéntica a Redlenic |
| **Archivo** | `backend/app/scrapers/protrade.py` |

**Características:**
- Catálogo en `catalogo2024.php?rub=99999`
- Productos en `div.contenedor_producto`
- Nombre en `h1`, precio en `p.datos`, código en `p.datos1`
- Si necesita password, agregar `"password": "xxx"` al scraper_config

### Playwright en Railway (solo DecoModa)

**Nota:** El scraper Sina ya **NO usa Playwright** (usa API REST directamente).

DecoModa usa Playwright con fallback a sitemap.xml:
- Localmente: instala chromium via `playwright install chromium`
- En Railway: puede fallar, usa sitemap como fallback (~113 productos vs 462 con JS)

**Problema persistente:** Playwright en Railway es problemático. Si un scraper necesita browser, considerar:
1. Usar API REST del sitio si existe (como Sina)
2. Usar Browserless.io (requiere cuenta de pago para evitar timeouts)
3. Aceptar fallback sin JavaScript

### Archivos Modificados/Creados

| Archivo | Cambio |
|---------|--------|
| `backend/alembic/versions/008_...` | **NUEVO** - Migración campos nuevos |
| `backend/app/scrapers/sina.py` | **NUEVO** - Scraper Sina (API REST, sin browser) |
| `backend/app/scrapers/protrade.py` | **NUEVO** - Scraper Protrade |
| `backend/app/scrapers/base.py` | Agregados min_purchase_qty y kit_content |
| `backend/app/models/product.py` | Columnas min_purchase_qty y kit_content |
| `backend/app/services/scrape_job.py` | Guardar campos nuevos al scrapear |
| `backend/app/main.py` | Import scrapers sina y protrade |
| `backend/scripts/seed_data.py` | Fuentes sina y protrade (actualiza existentes) |
| `backend/nixpacks.toml` | Simplificado: migrations + seed en build |
| `frontend/src/types/index.ts` | Campos min_purchase_qty y kit_content |

### Lista de Scrapers Registrados

| Scraper | Fuente | Auth | Notas |
|---------|--------|------|-------|
| `newredmayorista` | New Red Mayorista | No | Precios no visibles públicamente |
| `redlenic` | Redlenic | Password: `catan` | Todos productos en una página |
| `decomoda` | DecoModa Mayorista | No | Usa Playwright, fallback sitemap |
| `sina` | Sina | JWT (env vars) | **API REST**, campos extra |
| `protrade` | Protrade | No (o password) | Estructura = Redlenic |
| `manual` | Producto Manual | - | Productos creados a mano |

### Variables de Entorno para Scrapers

```
# Sina (requeridas para scraper sina)
SINA_USERNAME=email@ejemplo.com
SINA_PASSWORD=contraseña
```

---

## Sesión 2026-02-05

### Feature: ABM Completo de Subcategorías

Se ha implementado una funcionalidad completa para la gestión de subcategorías, permitiendo una clasificación de productos más granular. La implementación abarca desde la base de datos hasta la interfaz de usuario.

**Archivos Creados (Backend):**
- `backend/app/models/subcategory.py`: Modelo SQLAlchemy para la tabla `subcategories`.
- `backend/app/schemas/subcategory.py`: Schemas Pydantic para validación de datos en la API.
- `backend/alembic/versions/009_add_subcategories.py`: Migración de base de datos para crear la tabla y la relación con productos.
- `backend/app/api/v1/endpoints/subcategories.py`: Endpoints REST para el CRUD de subcategorías.

**Archivos Modificados (Backend):**
- `backend/app/models/product.py`: Añadida la relación `subcategory_id` al modelo `Product`.
- `backend/app/api/v1/router.py`: Registro del nuevo router de subcategorías.
- `backend/app/schemas/product.py`: Inclusión de la información de subcategoría en los schemas de producto.
- `backend/app/api/v1/endpoints/public.py`: Soporte para filtrar productos por subcategoría en la API pública.
- `backend/app/api/v1/endpoints/admin.py`: Soporte para filtrar y actualizar subcategorías masivamente en la API de admin.
- `backend/app/services/product.py`: Lógica de negocio actualizada para manejar subcategorías.
- `backend/app/db/repositories/product.py`: Actualización de las consultas a la base de datos para incluir filtros por subcategoría.

**Archivos Creados (Frontend):**
- `frontend/src/app/admin/subcategorias/page.tsx`: Nueva página para el ABM (Alta, Baja, Modificación) de subcategorías.

**Archivos Modificados (Frontend):**
- `frontend/src/types/index.ts`: Añadidos los tipos `Subcategory`.
- `frontend/src/lib/api.ts`: Funciones para interactuar con la API de subcategorías.
- `frontend/src/hooks/useProducts.ts`: Hook actualizado para manejar datos de subcategorías.
- `frontend/src/hooks/useAdminFilters.ts`: Añadido `subcategoryFilter` al estado de filtros persistentes (Zustand).
- `frontend/src/app/admin/layout.tsx`: Añadido el enlace "Subcategorías" en el menú de navegación del admin.
- `frontend/src/app/admin/productos/page.tsx`: Interfaz para filtrar productos por subcategoría.
- `frontend/src/components/admin/ProductTable.tsx`: Desplegable para mostrar y cambiar la subcategoría en la tabla de productos.
- `frontend/src/app/page.tsx`: Implementado filtro jerárquico por categorías y subcategorías en la página pública.

**Navegación Admin Actualizada:**
El menú de configuración ahora incluye "Subcategorías":
- **Configuración**
  - Categorías
  - Subcategorías (NUEVO)
- Webs Origen

---

## SesiÃ³n 2026-02-06

### Frontend pÃºblico: Banner "CÃ³mo trabajamos" + Modal informativo
- **Archivo:** `frontend/src/app/page.tsx`
  - Banner debajo del header con CTA "Â¿Primera vez comprando con nosotros? Te contamos acÃ¡"
  - Abre modal informativo con pasos del proceso
- **Archivo:** `frontend/src/components/public/HowWeWorkModal.tsx`
  - Modal con explicaciÃ³n del modelo (catÃ¡logo curado + asesoramiento + entrega inmediata)
  - CTA a WhatsApp si `NEXT_PUBLIC_WHATSAPP_NUMBER` estÃ¡ configurado

### WhatsApp: CTA y mensajes enriquecidos
- **Archivo:** `frontend/src/components/public/ContactButton.tsx`
  - Mensaje incluye nombre, precio (si existe) y URL del producto
  - Usa `NEXT_PUBLIC_SITE_URL` si estÃ¡ definido; fallback a `window.location.origin`
  - BotÃ³n flotante de WhatsApp en mobile
- **Archivo:** `frontend/src/lib/utils.ts`
  - `getWhatsAppUrl(phone, message)` centraliza la URL

### Exportar PDF desde Admin (catÃ¡logo o lista)
- **Frontend (Admin):** `frontend/src/app/admin/productos/page.tsx`
  - Dropdown "Acciones" agrega:
    - Exportar PDF (catÃ¡logo con imÃ¡genes)
    - Exportar PDF (lista de precios)
- **Backend:** `GET /admin/products/export/pdf?format=catalog|list`
  - **Archivo:** `backend/app/api/v1/endpoints/admin.py`
  - **Servicio:** `backend/app/services/pdf_generator.py`
    - Genera PDF con branding, precios, descripciones e imÃ¡genes
    - Usa imÃ¡genes locales (uploads) o HTTP
    - Incluye secciÃ³n "Nuevo" si hay productos destacados
    - WhatsApp en header/footer con número hardcodeado `WHATSAPP_NUMBER`

---

## Sesión 2026-03-06

### Fix: URL producto en mensaje WhatsApp
- **Archivo:** `frontend/src/components/public/ContactButton.tsx`
- `NEXT_PUBLIC_SITE_URL` ahora tiene fallback hardcodeado a `https://www.hefaproductos.com.ar` (antes usaba `window.location.origin` que podía ser localhost u otro dominio)

### Feature: Ranking de Clientes
- **Ruta:** `/admin/clientes-ranking`
- **Página:** `frontend/src/app/admin/clientes-ranking/page.tsx`
- **Endpoint:** `GET /admin/stats/customer-ranking`
- **Servicio:** `SalesService.customer_ranking()` en `backend/app/services/sales.py`

**Detalles técnicos importantes:**
- La query usa **dos subqueries separadas** para evitar duplicar datos:
  - `sale_agg`: agrupa por cliente en `sales` → purchase_count + total_amount
  - `item_agg`: agrupa por cliente con JOIN a `sale_items` → product_count (suma de cantidades)
  - Unirlas con `outerjoin` evita que el total_amount se multiplique por cantidad de ítems
- La query inicial con un solo JOIN tenía el bug de triplicar valores

**Funcionalidades de la página:**
- Tabla con ranking (🥇🥈🥉 para top 3), ordenable por cualquier columna
- Buscador de cliente (filtro client-side, sin llamadas extra al backend)
- Click en fila → drawer lateral con ventas del cliente
- Drawer carga via `listSales(apiKey, 200, customerName)` y filtra por nombre exacto
- Cada venta en el drawer es una card expandible con ítems, estados de entrega/pago y totales
- Indicadores de estado iguales a la vista de ventas (verde=completo, amarillo=parcial, vacío=pendiente)

### Reorganización del menú admin
- **Archivo:** `frontend/src/app/admin/layout.tsx`
- Menú reescrito con 4 submenús y componentes reutilizables `SidebarSubmenu` / `MobileSubmenu`
- Estado de abierto/cerrado centralizado en hook `useSubmenuState`
- Ver tabla completa en sección "Estado actual del menú admin"

### Dashboard: resumen financiero al tope
- **Archivo:** `frontend/src/app/admin/page.tsx`
- El bloque "Resumen financiero" se movió para aparecer primero, antes de las cards de productos y pedidos

### Mejora: modal Nueva Venta
- **Archivo:** `frontend/src/app/admin/ventas/page.tsx`
- La tabla de ítems del carrito fue reemplazada por cards por ítem
- Cada card muestra el nombre completo del producto (sin truncar)
- Precio editable con label visible ("Precio $")
- Botón eliminar (✕) rojo visible en cada ítem
- Checks de Entregado/Pagado con etiqueta al lado

### Feature: Búsqueda de imágenes en IA
- **Archivos modificados:**
  - `backend/app/services/ai_description.py`
  - `backend/app/api/v1/endpoints/ai_descriptions.py`
  - `frontend/src/lib/api.ts` (campo `use_image_search` en `AIGenerateRequest`)
  - `frontend/src/app/admin/ai-descripciones/page.tsx` (toggle "Buscar imágenes")
- **Comportamiento:** usa Brave Image Search API (misma clave que búsqueda web)
- **Condición:** solo actúa en productos **sin imágenes existentes** (`product.images == []`)
- **Resultado:** guarda hasta 3 URLs en `product_images`, la primera como `is_primary=True`
- Toggle desactivado por defecto (es una operación con efectos secundarios irreversibles)
