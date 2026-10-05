# Catálogo de Revendedor

Sistema de catálogo web y gestión para revendedores.

## Características

- **Panel administrativo**: Gestiona productos (carga manual), precios y markup
- **Compras y stock**: Compras a proveedores, depósitos y stock por producto
- **Ventas**: Minoristas, pedidos y canal mayorista (comercios)
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
│   │   ├── services/ # Business logic
│   │   └── main.py   # Entry point
│   └── alembic/      # Migraciones DB
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

### 1. Agregar Productos

1. Acceder al admin: `/admin` e ingresar la API Key
2. Ir a "Productos" → "Agregar Producto"
3. Completar nombre, precio, categoría e imágenes

### 2. Configurar Precios

1. Editar el producto
2. Ajustar el **markup** (porcentaje de ganancia) o fijar un precio
3. Habilitar el producto para mostrarlo en el catálogo público

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
- `POST /api/v1/admin/products/manual` - Crear
- `PATCH /api/v1/admin/products/{id}` - Actualizar
- `DELETE /api/v1/admin/products/{id}` - Eliminar

## Tecnologías

### Backend
- FastAPI (Python)
- SQLAlchemy 2.0
- PostgreSQL
- Alembic (migraciones)

### Frontend
- Next.js 14 (App Router)
- React 18
- TailwindCSS
- React Query
- Zustand

## Licencia

MIT
