"""Main API v1 router."""
from fastapi import APIRouter

from app.api.v1.endpoints import public, admin, source_websites, categories, subcategories, ai_descriptions, app_settings, sections, expenses, mercadopago, comercios_public, comercios_protected, comercios_admin
from app.api.v1.endpoints.import_scorer import (
    templates as is_templates,
    retailers as is_retailers,
    outlets as is_outlets,
    rubros as is_rubros,
    dashboard as is_dashboard,
    carritos as is_carritos,
    productos as is_productos,
    scrape as is_scrape,
    analytics as is_analytics,
    config_endpoint as is_config,
    lista_caza as is_lista_caza,
    radar as is_radar,
)

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

# Source websites management
api_router.include_router(
    source_websites.router,
    prefix="/admin/source-websites",
    tags=["source-websites"]
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

# ── Import Scorer ──────────────────────────────────────────────────────────────
api_router.include_router(
    is_dashboard.router,
    prefix="/admin/import-scorer",
    tags=["import-scorer"],
)
api_router.include_router(
    is_templates.router,
    prefix="/admin/import-scorer/templates",
    tags=["import-scorer-templates"],
)
api_router.include_router(
    is_retailers.router,
    prefix="/admin/import-scorer/retailers",
    tags=["import-scorer-retailers"],
)
api_router.include_router(
    is_outlets.router,
    prefix="/admin/import-scorer/outlets",
    tags=["import-scorer-outlets"],
)
api_router.include_router(
    is_rubros.router,
    prefix="/admin/import-scorer/rubros",
    tags=["import-scorer-rubros"],
)
api_router.include_router(
    is_carritos.router,
    prefix="/admin/import-scorer/carritos",
    tags=["import-scorer-carritos"],
)
api_router.include_router(
    is_productos.router,
    prefix="/admin/import-scorer/productos",
    tags=["import-scorer-productos"],
)
api_router.include_router(
    is_scrape.router,
    prefix="/admin/import-scorer/scrape",
    tags=["import-scorer-scrape"],
)
api_router.include_router(
    is_analytics.router,
    prefix="/admin/import-scorer/analytics",
    tags=["import-scorer-analytics"],
)
api_router.include_router(
    is_config.router,
    prefix="/admin/import-scorer/config",
    tags=["import-scorer-config"],
)
api_router.include_router(
    is_lista_caza.router,
    prefix="/admin/import-scorer/listas-caza",
    tags=["import-scorer-listas-caza"],
)
api_router.include_router(
    is_radar.router,
    prefix="/admin/import-scorer/radar",
    tags=["import-scorer-radar"],
)
