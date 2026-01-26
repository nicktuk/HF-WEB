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
