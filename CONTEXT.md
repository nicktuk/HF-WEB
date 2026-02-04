# HF WEB - Contexto del Proyecto

## Arquitectura

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

### Scraper Sina (Nuevo)

#### Ubicación
- **Scraper:** `backend/app/scrapers/sina.py`
- **Registro:** Importado en `backend/app/main.py`

#### Configuración
- **Identificador fuente:** `sina`
- **URL Base:** `https://www.sina.com.ar`
- **Requiere autenticación:** Sí

#### Credenciales (guardar en scraper_config)
```json
{
  "username": "diezjuarez22@gmail.com",
  "password": "Hermanos1997!"
}
```

#### Características
- Usa **Playwright** para renderizar JavaScript y manejar login
- Extrae campos adicionales:
  - `min_purchase_qty` - Cantidad mínima de compra
  - `kit_content` - Contenido del kit/combo
  - `sku` - Código de producto
- Intenta usar API interna primero, fallback a parsing de página
- URL de producto: `https://www.sina.com.ar/{cat}/{subcat}/{nombre}/{id}`

#### Nuevos Campos en Modelo Product
- **Migración:** `backend/alembic/versions/008_add_min_purchase_qty_and_kit_content.py`
- **Campos:**
  - `min_purchase_qty` (Integer, nullable) - Cantidad mínima de compra
  - `kit_content` (Text, nullable) - Contenido del kit/combo

#### Archivos Modificados/Creados

| Archivo | Cambio |
|---------|--------|
| `backend/alembic/versions/008_...` | **NUEVO** - Migración campos nuevos |
| `backend/app/scrapers/sina.py` | **NUEVO** - Scraper Sina con Playwright |
| `backend/app/scrapers/base.py` | Agregados min_purchase_qty y kit_content a ScrapedProduct |
| `backend/app/models/product.py` | Agregadas columnas min_purchase_qty y kit_content |
| `backend/app/schemas/product.py` | Agregados campos en schemas de respuesta |
| `backend/app/services/product.py` | Guardar campos nuevos al scrapear |
| `backend/app/main.py` | Import scraper sina |
| `frontend/src/types/index.ts` | Agregados min_purchase_qty y kit_content a ProductAdmin |

#### Pasos para usar el scraper

1. **Correr migración:**
   ```bash
   cd backend
   alembic upgrade head
   ```

2. **Crear fuente en admin:**
   - Ir a Admin → Webs de Origen → Nueva Web
   - Nombre identificador: `sina`
   - Nombre display: `Sina`
   - URL base: `https://www.sina.com.ar`
   - Scraper config (JSON):
     ```json
     {"username": "diezjuarez22@gmail.com", "password": "Hermanos1997!"}
     ```

3. **Ejecutar scraping:**
   - Desde admin o vía API: `POST /admin/source-websites/{id}/scrape-all`
