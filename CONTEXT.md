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
