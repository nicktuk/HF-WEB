# Catálogo de Revendedor

Sistema de catálogo web para revendedores con inteligencia de precios de mercado.

## Características

- **Múltiples webs de origen**: Configura varias fuentes de productos (mayoristas)
- **Scraping automático**: Extrae información de productos automáticamente
- **Inteligencia de precios**: Compara tus precios con el mercado (MercadoLibre, etc.)
- **Panel administrativo**: Gestiona productos, precios y markup
- **Catálogo público**: Web responsive para tus clientes

## Estructura del Proyecto

```
├── backend/          # API FastAPI (Python)
│   ├── app/
│   │   ├── api/      # Endpoints
│   │   ├── core/     # Seguridad, excepciones
│   │   ├── db/       # Database, repositorios
│   │   ├── models/   # SQLAlchemy models
│   │   ├── schemas/  # Pydantic schemas
│   │   ├── scrapers/ # Web scrapers
│   │   ├── services/ # Business logic
│   │   └── main.py   # Entry point
│   ├── alembic/      # Migraciones DB
│   └── scripts/      # Scripts auxiliares
│
└── frontend/         # Next.js (React)
    └── src/
        ├── app/      # Páginas (App Router)
        ├── components/
        ├── hooks/
        ├── lib/
        └── types/
```

## Requisitos

- Python 3.11+
- Node.js 18+
- PostgreSQL 15+

## Setup Local

### Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# Crear base de datos
createdb catalog_db  # o usar pgAdmin

# Ejecutar migraciones
alembic upgrade head

# Seed inicial
python -m scripts.seed_data

# Ejecutar servidor
uvicorn app.main:app --reload
```

API disponible en: http://localhost:8000
Docs: http://localhost:8000/docs

### Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus valores

# Ejecutar servidor de desarrollo
npm run dev
```

Frontend disponible en: http://localhost:3000
Admin: http://localhost:3000/admin

## Configuración

### Backend (.env)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/catalog_db
ADMIN_API_KEY=tu_api_key_secreta
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
NEXT_PUBLIC_WHATSAPP_NUMBER=5491133240285
NEXT_PUBLIC_SITE_NAME=HeFa - Productos
```

## Uso

### 1. Configurar Web de Origen

1. Acceder al admin: `/admin`
2. Ingresar API Key
3. Ir a "Webs Origen"
4. Agregar la web mayorista (ya viene pre-configurada `newredmayorista`)

### 2. Agregar Productos

1. Ir a "Productos"
2. Click en "Agregar Producto"
3. Seleccionar la web de origen
4. Ingresar el **slug** del producto (la parte de la URL)
   - Ejemplo: `heladera-bgh-inox-404l` de la URL `https://newredmayorista.com.ar/producto/heladera-bgh-inox-404l/`
5. El sistema scrapeará la información automáticamente

### 3. Configurar Precios

1. Editar el producto
2. Ajustar el **markup** (porcentaje de ganancia)
3. Usar el widget de **inteligencia de precios** para comparar con el mercado
4. Habilitar el producto para mostrarlo en el catálogo público

### 4. Inteligencia de Precios

- Click en "Actualizar precios de mercado" para buscar productos similares
- El sistema buscará en MercadoLibre y calculará:
  - Precio promedio
  - Precio mínimo
  - Precio máximo
- Te indicará si tu precio es competitivo

## Deploy

### Railway (recomendado)

1. Conectar repo a Railway
2. Agregar servicio PostgreSQL
3. Configurar variables de entorno
4. Deploy automático

### Docker

```bash
# Backend
cd backend
docker build -t catalog-api .
docker run -p 8000:8000 --env-file .env catalog-api

# O con docker-compose
docker-compose up
```

### Vercel (Frontend)

1. Conectar repo a Vercel
2. Configurar variables de entorno
3. Deploy automático

## API Endpoints

### Públicos (sin auth)

- `GET /api/v1/public/products` - Catálogo
- `GET /api/v1/public/products/{slug}` - Detalle producto
- `GET /api/v1/public/categories` - Categorías

### Admin (requiere `X-Admin-API-Key` header)

- `GET /api/v1/admin/products` - Listar productos
- `POST /api/v1/admin/products` - Crear (scrapear)
- `PATCH /api/v1/admin/products/{id}` - Actualizar
- `DELETE /api/v1/admin/products/{id}` - Eliminar
- `POST /api/v1/admin/products/{id}/rescrape` - Re-scrapear
- `GET /api/v1/admin/products/{id}/market-prices` - Precios de mercado
- `POST /api/v1/admin/products/{id}/market-prices/refresh` - Actualizar precios

## Tecnologías

### Backend
- FastAPI (Python)
- SQLAlchemy 2.0
- PostgreSQL
- httpx + BeautifulSoup (scraping)
- APScheduler (tareas programadas)

### Frontend
- Next.js 14 (App Router)
- React 18
- TailwindCSS
- React Query
- Zustand

## Licencia

MIT
