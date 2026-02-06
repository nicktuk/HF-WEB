"""Main API v1 router."""
from fastapi import APIRouter

from app.api.v1.endpoints import public, admin, source_websites, categories, subcategories

api_router = APIRouter()

# Public endpoints (no auth required)
api_router.include_router(
    public.router,
    prefix="/public",
    tags=["public"]
)

# Admin endpoints (auth required)
api_router.include_router(
    admin.router,
    prefix="/admin",
    tags=["admin"]
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
