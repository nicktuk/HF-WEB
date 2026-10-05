"""Main API v1 router."""
from fastapi import APIRouter

from app.api.v1.endpoints import public, admin, categories, subcategories, ai_descriptions, app_settings, sections, expenses, mercadopago, comercios_public, comercios_protected, comercios_admin, comision_minorista, catalog_sellers, bot_vendedores, codigos_amba, vendedores_public, vendedores_protected

api_router = APIRouter()

# Public endpoints (no auth required)
api_router.include_router(
    public.router,
    prefix="/public",
    tags=["public"]
)

# Comercio public endpoints (login, solicitud, estado)
api_router.include_router(
    comercios_public.router,
    prefix="/public",
    tags=["comercios-public"]
)

# Comercio protected endpoints (catalogo, pedidos — requieren JWT)
api_router.include_router(
    comercios_protected.router,
    prefix="/comercios",
    tags=["comercios"]
)

# Vendedor public endpoints (login, recupero, estado)
api_router.include_router(
    vendedores_public.router,
    prefix="/public",
    tags=["vendedores-public"]
)

# Vendedor protected endpoints (info, set-password — requieren JWT propio)
api_router.include_router(
    vendedores_protected.router,
    prefix="/vendedores",
    tags=["vendedores"]
)

# Mercado Pago Checkout Bricks
api_router.include_router(
    mercadopago.router,
    prefix="/public",
    tags=["mercadopago"]
)

# Admin endpoints (auth required)
api_router.include_router(
    admin.router,
    prefix="/admin",
    tags=["admin"]
)

# Comercios admin (superadmin only)
api_router.include_router(
    comercios_admin.router,
    prefix="/admin",
    tags=["comercios-admin"]
)

# Comisión minorista (matriz semanal del canal ventas propias)
api_router.include_router(
    comision_minorista.router,
    prefix="/admin",
    tags=["comision-minorista"]
)

# Catalog sellers (CRUD simple sobre la misma tabla catalog_sellers, usado por
# los dropdowns de ventas/pedidos/depósitos/compras; /admin/vendedores en
# comercios_admin.py es la vista completa con el flag es_mayorista)
api_router.include_router(
    catalog_sellers.router,
    prefix="/admin",
    tags=["catalog-sellers"]
)

# Códigos postales AMBA (clasificación automática de zona de envío)
api_router.include_router(
    codigos_amba.router,
    prefix="/admin",
    tags=["codigos-amba"]
)

# Bot de ventas de vendedores por WhatsApp (orquestado desde n8n)
api_router.include_router(
    bot_vendedores.router,
    tags=["bot-vendedores"]
)

# Categories management
api_router.include_router(
    categories.router,
    prefix="/categories",
    tags=["categories"]
)

# Subcategories management
api_router.include_router(
    subcategories.router,
    prefix="/subcategories",
    tags=["subcategories"]
)

# AI Description Generation
api_router.include_router(
    ai_descriptions.router,
    prefix="/admin/ai",
    tags=["ai-descriptions"]
)

# App Settings (admin)
api_router.include_router(
    app_settings.router,
    prefix="/admin/settings",
    tags=["app-settings"]
)

# Sections
api_router.include_router(
    sections.router,
    prefix="/sections",
    tags=["sections"]
)

# Expenses
api_router.include_router(
    expenses.router,
    prefix="/admin/expenses",
    tags=["expenses"]
)

