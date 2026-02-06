"""Public API endpoints - No authentication required."""
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_product_service
from app.services.product import ProductService
from app.schemas.product import ProductPublicResponse
from app.schemas.common import PaginatedResponse
from app.config import settings

router = APIRouter()

# Rate limiter for public endpoints
limiter = Limiter(key_func=get_remote_address)


@router.get("/products", response_model=PaginatedResponse[ProductPublicResponse])
@limiter.limit(settings.RATE_LIMIT_PUBLIC)
async def get_products(
    request: Request,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=1000),
    category: Optional[str] = Query(default=None),
    subcategory: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=100),
    featured: Optional[bool] = Query(default=None),
    immediate_delivery: Optional[bool] = Query(default=None),
    service: ProductService = Depends(get_product_service),
):
    """
    Get public product catalog.

    Returns only enabled products with calculated final prices.
    Use featured=true to get only featured products (Novedades).
    Use immediate_delivery=true to get only products with immediate delivery.
    """
    products, total = service.get_public_catalog(page, limit, category, subcategory, search, featured, immediate_delivery)
    pages = (total + limit - 1) // limit if limit > 0 else 0

    return PaginatedResponse(
        items=products,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get("/products/{slug}", response_model=ProductPublicResponse)
@limiter.limit(settings.RATE_LIMIT_PUBLIC)
async def get_product(
    request: Request,
    slug: str,
    service: ProductService = Depends(get_product_service),
):
    """
    Get a single product by slug.

    Returns 404 if product not found or not enabled.
    """
    return service.get_public_product(slug)


@router.get("/categories")
@limiter.limit(settings.RATE_LIMIT_PUBLIC)
async def get_categories(
    request: Request,
    service: ProductService = Depends(get_product_service),
):
    """Get list of available categories with their properties."""
    return service.get_public_categories()


@router.get("/subcategories")
@limiter.limit(settings.RATE_LIMIT_PUBLIC)
async def get_subcategories(
    request: Request,
    category: Optional[str] = Query(default=None),
    service: ProductService = Depends(get_product_service),
):
    """Get list of available subcategories with their properties."""
    return service.get_public_subcategories(category)
