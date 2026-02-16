"""Public API endpoints - No authentication required."""
from typing import Optional
import json
import logging
from fastapi import APIRouter, Depends, Query, Request
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import get_product_service
from app.services.product import ProductService
from app.schemas.product import ProductPublicResponse
from app.schemas.common import PaginatedResponse, MessageResponse
from app.schemas.analytics import PublicEventCreate
from app.models.analytics_event import AnalyticsEvent
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

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


@router.post("/events", response_model=MessageResponse)
@limiter.limit(settings.RATE_LIMIT_PUBLIC)
async def track_public_event(
    request: Request,
    payload: PublicEventCreate,
    service: ProductService = Depends(get_product_service),
):
    """Track anonymous public frontend events for basic navigation analytics."""
    forwarded_for = request.headers.get("x-forwarded-for")
    ip_address = forwarded_for.split(",")[0].strip() if forwarded_for else (request.client.host if request.client else None)

    event = AnalyticsEvent(
        event_name=payload.event_name,
        session_id=payload.session_id,
        path=payload.path,
        referrer=payload.referrer,
        user_agent=request.headers.get("user-agent"),
        ip_address=ip_address,
        category=payload.category,
        subcategory=payload.subcategory,
        product_id=payload.product_id,
        product_slug=payload.product_slug,
        search_query=payload.search_query,
        metadata_json=json.dumps(payload.metadata, ensure_ascii=False) if payload.metadata else None,
    )

    try:
        service.db.add(event)
        service.db.commit()
    except Exception:
        service.db.rollback()
        logger.exception("Failed to store public analytics event")
        return MessageResponse(message="Event dropped", success=False)

    return MessageResponse(message="Event tracked", success=True)
