"""Admin API endpoints - Authentication required."""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Request, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
import io
import os
import uuid
from pathlib import Path

from app.api.deps import (
    get_product_service,
    get_market_intelligence_service,
)
from app.services.product import ProductService
from app.services.market_intelligence import MarketIntelligenceService
from app.services.pdf_generator import PDFGeneratorService
from app.schemas.product import (
    ProductCreate,
    ProductCreateManual,
    ProductUpdate,
    ProductAdminResponse,
    ProductBulkAction,
    ProductBulkMarkup,
    ProductActivateInactive,
    ProductActivateSelected,
    ProductChangeCategorySelected,
    ProductDisableSelected,
)
from app.schemas.market_price import (
    MarketPriceStatsResponse,
    MarketPriceRefreshRequest,
    PriceComparisonResponse,
)
from app.schemas.common import PaginatedResponse, MessageResponse
from app.core.security import verify_admin
from app.config import settings

router = APIRouter()

limiter = Limiter(key_func=get_remote_address)


# ============================================
# Product Management
# ============================================

@router.get(
    "/products",
    response_model=PaginatedResponse[ProductAdminResponse],
    dependencies=[Depends(verify_admin)]
)
@limiter.limit(settings.RATE_LIMIT_ADMIN)
async def get_products_admin(
    request: Request,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    enabled: Optional[bool] = Query(default=None),
    source_website_id: Optional[int] = Query(default=None),
    search: Optional[str] = Query(default=None, max_length=100),
    category: Optional[str] = Query(default=None, max_length=100),
    is_featured: Optional[bool] = Query(default=None),
    is_immediate_delivery: Optional[bool] = Query(default=None),
    service: ProductService = Depends(get_product_service),
):
    """
    Get all products for admin management.

    Includes disabled products, market price stats, and source info.
    """
    products, total = service.get_all_admin(
        page,
        limit,
        enabled,
        source_website_id,
        search,
        category,
        is_featured,
        is_immediate_delivery
    )
    pages = (total + limit - 1) // limit if limit > 0 else 0

    # Transform to admin response with market stats
    admin_products = []
    for p in products:
        stats = p.market_price_stats
        admin_products.append(ProductAdminResponse(
            id=p.id,
            slug=p.slug,
            original_name=p.original_name,
            custom_name=p.custom_name,
            original_price=p.original_price,
            markup_percentage=p.markup_percentage,
            custom_price=p.custom_price,
            description=p.description,
            short_description=p.short_description,
            brand=p.brand,
            sku=p.sku,
            category=p.category,
            enabled=p.enabled,
            is_featured=p.is_featured,
            is_immediate_delivery=p.is_immediate_delivery,
            is_check_stock=p.is_check_stock,
            images=[{
                "id": img.id,
                "url": img.url,
                "alt_text": img.alt_text,
                "is_primary": img.is_primary
            } for img in p.images],
            created_at=p.created_at,
            updated_at=p.updated_at,
            source_website_id=p.source_website_id,
            source_website_name=p.source_website.display_name if p.source_website else None,
            source_url=p.source_url,
            last_scraped_at=p.last_scraped_at,
            scrape_error_count=p.scrape_error_count,
            scrape_last_error=p.scrape_last_error,
            display_order=p.display_order,
            market_avg_price=stats.avg_price if stats else None,
            market_min_price=stats.min_price if stats else None,
            market_max_price=stats.max_price if stats else None,
            market_sample_count=stats.sample_count if stats else 0,
        ))

    return PaginatedResponse(
        items=admin_products,
        total=total,
        page=page,
        limit=limit,
        pages=pages,
    )


@router.get(
    "/products/{product_id}",
    response_model=ProductAdminResponse,
    dependencies=[Depends(verify_admin)]
)
async def get_product_admin(
    product_id: int,
    service: ProductService = Depends(get_product_service),
):
    """Get a single product with full admin details."""
    p = service.get_by_id(product_id)
    stats = p.market_price_stats

    return ProductAdminResponse(
        id=p.id,
        slug=p.slug,
        original_name=p.original_name,
        custom_name=p.custom_name,
        original_price=p.original_price,
        markup_percentage=p.markup_percentage,
        custom_price=p.custom_price,
        description=p.description,
        short_description=p.short_description,
        brand=p.brand,
        sku=p.sku,
        category=p.category,
        enabled=p.enabled,
        is_featured=p.is_featured,
            is_immediate_delivery=p.is_immediate_delivery,
        images=[{
            "id": img.id,
            "url": img.url,
            "alt_text": img.alt_text,
            "is_primary": img.is_primary
        } for img in p.images],
        created_at=p.created_at,
        updated_at=p.updated_at,
        source_website_id=p.source_website_id,
        source_website_name=p.source_website.display_name if p.source_website else None,
        source_url=p.source_url,
        last_scraped_at=p.last_scraped_at,
        scrape_error_count=p.scrape_error_count,
        scrape_last_error=p.scrape_last_error,
        display_order=p.display_order,
        market_avg_price=stats.avg_price if stats else None,
        market_min_price=stats.min_price if stats else None,
        market_max_price=stats.max_price if stats else None,
        market_sample_count=stats.sample_count if stats else 0,
    )


@router.post(
    "/products",
    response_model=ProductAdminResponse,
    status_code=201,
    dependencies=[Depends(verify_admin)]
)
@limiter.limit("30/minute")
async def create_product(
    request: Request,
    data: ProductCreate,
    service: ProductService = Depends(get_product_service),
):
    """
    Create a new product by scraping from source website.

    Provide the source_website_id and product slug.
    The system will scrape product information automatically.
    """
    product = await service.create_from_slug(data)

    return ProductAdminResponse(
        id=product.id,
        slug=product.slug,
        original_name=product.original_name,
        custom_name=product.custom_name,
        original_price=product.original_price,
        markup_percentage=product.markup_percentage,
        custom_price=product.custom_price,
        description=product.description,
        short_description=product.short_description,
        brand=product.brand,
        sku=product.sku,
        category=product.category,
        enabled=product.enabled,
        is_featured=product.is_featured,
        is_immediate_delivery=product.is_immediate_delivery,
        is_check_stock=product.is_check_stock,
        images=[{
            "id": img.id,
            "url": img.url,
            "alt_text": img.alt_text,
            "is_primary": img.is_primary
        } for img in product.images],
        created_at=product.created_at,
        updated_at=product.updated_at,
        source_website_id=product.source_website_id,
        source_website_name=product.source_website.display_name if product.source_website else None,
        source_url=product.source_url,
        last_scraped_at=product.last_scraped_at,
        scrape_error_count=product.scrape_error_count,
        scrape_last_error=product.scrape_last_error,
        display_order=product.display_order,
        market_avg_price=None,
        market_min_price=None,
        market_max_price=None,
        market_sample_count=0,
    )


@router.post(
    "/products/manual",
    response_model=ProductAdminResponse,
    status_code=201,
    dependencies=[Depends(verify_admin)]
)
@limiter.limit("30/minute")
async def create_product_manual(
    request: Request,
    data: ProductCreateManual,
    service: ProductService = Depends(get_product_service),
):
    """
    Create a new product manually without scraping.

    Provide name, price, description, images, etc. directly.
    Useful for products not available in source catalogs.
    """
    product = service.create_manual(data)

    return ProductAdminResponse(
        id=product.id,
        slug=product.slug,
        original_name=product.original_name,
        custom_name=product.custom_name,
        original_price=product.original_price,
        markup_percentage=product.markup_percentage,
        custom_price=product.custom_price,
        description=product.description,
        short_description=product.short_description,
        brand=product.brand,
        sku=product.sku,
        category=product.category,
        enabled=product.enabled,
        is_featured=product.is_featured,
        is_immediate_delivery=product.is_immediate_delivery,
        is_check_stock=product.is_check_stock,
        images=[{
            "id": img.id,
            "url": img.url,
            "alt_text": img.alt_text,
            "is_primary": img.is_primary
        } for img in product.images],
        created_at=product.created_at,
        updated_at=product.updated_at,
        source_website_id=product.source_website_id,
        source_website_name="Producto Manual",
        source_url=product.source_url,
        last_scraped_at=product.last_scraped_at,
        scrape_error_count=product.scrape_error_count,
        scrape_last_error=product.scrape_last_error,
        display_order=product.display_order,
        market_avg_price=None,
        market_min_price=None,
        market_max_price=None,
        market_sample_count=0,
    )


# ============================================
# Image Upload
# ============================================

@router.post(
    "/upload/images",
    dependencies=[Depends(verify_admin)]
)
@limiter.limit("60/minute")
async def upload_images(
    request: Request,
    files: List[UploadFile] = File(...),
):
    """
    Upload images for manual products.

    Returns list of URLs for the uploaded images.
    Supports JPEG, PNG, WebP, GIF. Max 10MB per file.
    """
    uploaded_urls = []

    # Ensure upload directory exists
    upload_dir = Path(settings.UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    for file in files:
        # Validate file type
        if file.content_type not in settings.ALLOWED_IMAGE_TYPES:
            raise HTTPException(
                status_code=400,
                detail=f"File type {file.content_type} not allowed. Allowed: {settings.ALLOWED_IMAGE_TYPES}"
            )

        # Read file content
        content = await file.read()

        # Validate file size
        if len(content) > settings.MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE // (1024*1024)}MB"
            )

        # Generate unique filename
        ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = upload_dir / filename

        # Save file
        with open(filepath, 'wb') as f:
            f.write(content)

        # Return URL (will be served by static files)
        uploaded_urls.append(f"/uploads/{filename}")

    return {"urls": uploaded_urls}


@router.patch(
    "/products/{product_id}",
    response_model=ProductAdminResponse,
    dependencies=[Depends(verify_admin)]
)
async def update_product(
    product_id: int,
    data: ProductUpdate,
    service: ProductService = Depends(get_product_service),
):
    """
    Update product settings.

    Can update: enabled, markup_percentage, custom_name, custom_price, category, display_order
    """
    product = service.update(product_id, data)

    stats = product.market_price_stats
    return ProductAdminResponse(
        id=product.id,
        slug=product.slug,
        original_name=product.original_name,
        custom_name=product.custom_name,
        original_price=product.original_price,
        markup_percentage=product.markup_percentage,
        custom_price=product.custom_price,
        description=product.description,
        short_description=product.short_description,
        brand=product.brand,
        sku=product.sku,
        category=product.category,
        enabled=product.enabled,
        is_featured=product.is_featured,
        is_immediate_delivery=product.is_immediate_delivery,
        is_check_stock=product.is_check_stock,
        images=[{
            "id": img.id,
            "url": img.url,
            "alt_text": img.alt_text,
            "is_primary": img.is_primary
        } for img in product.images],
        created_at=product.created_at,
        updated_at=product.updated_at,
        source_website_id=product.source_website_id,
        source_website_name=product.source_website.display_name if product.source_website else None,
        source_url=product.source_url,
        last_scraped_at=product.last_scraped_at,
        scrape_error_count=product.scrape_error_count,
        scrape_last_error=product.scrape_last_error,
        display_order=product.display_order,
        market_avg_price=stats.avg_price if stats else None,
        market_min_price=stats.min_price if stats else None,
        market_max_price=stats.max_price if stats else None,
        market_sample_count=stats.sample_count if stats else 0,
    )


@router.post(
    "/products/{product_id}/rescrape",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
@limiter.limit("10/minute")
async def rescrape_product(
    request: Request,
    product_id: int,
    service: ProductService = Depends(get_product_service),
):
    """Re-scrape product data from source website."""
    await service.rescrape(product_id)
    return MessageResponse(message="Product data updated from source")


@router.delete(
    "/products/{product_id}",
    status_code=204,
    dependencies=[Depends(verify_admin)]
)
async def delete_product(
    product_id: int,
    service: ProductService = Depends(get_product_service),
):
    """Delete a product."""
    service.delete(product_id)


@router.post(
    "/products/bulk-action",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
async def bulk_action(
    data: ProductBulkAction,
    service: ProductService = Depends(get_product_service),
):
    """
    Perform bulk actions on products.

    Actions: enable, disable, delete
    """
    if data.action == "enable":
        count = service.bulk_enable(data.product_ids, True)
        return MessageResponse(message=f"Enabled {count} products")
    elif data.action == "disable":
        count = service.bulk_enable(data.product_ids, False)
        return MessageResponse(message=f"Disabled {count} products")
    elif data.action == "delete":
        for pid in data.product_ids:
            service.delete(pid)
        return MessageResponse(message=f"Deleted {len(data.product_ids)} products")


@router.post(
    "/products/bulk-markup",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
async def bulk_set_markup(
    data: ProductBulkMarkup,
    service: ProductService = Depends(get_product_service),
):
    """
    Set markup percentage for products.

    By default only updates enabled products.
    Set only_enabled=false to update all products.
    Set source_website_id to filter by source.
    """
    count = service.bulk_set_markup(
        data.markup_percentage,
        data.only_enabled,
        data.source_website_id
    )
    scope = "habilitados" if data.only_enabled else "todos"
    source_msg = f" de fuente {data.source_website_id}" if data.source_website_id else ""
    return MessageResponse(message=f"Markup {data.markup_percentage}% aplicado a {count} productos {scope}{source_msg}")


@router.post(
    "/products/activate-all-inactive",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
async def activate_all_inactive(
    data: ProductActivateInactive,
    service: ProductService = Depends(get_product_service),
):
    """
    Activate all inactive products and apply markup.

    This will:
    - Enable all currently disabled products
    - Apply the specified markup percentage to them
    """
    count = service.activate_all_inactive_with_markup(data.markup_percentage)
    return MessageResponse(message=f"Activados {count} productos con markup de {data.markup_percentage}%")


@router.post(
    "/products/activate-selected",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
async def activate_selected(
    data: ProductActivateSelected,
    service: ProductService = Depends(get_product_service),
):
    """
    Activate selected products and apply markup.

    This will:
    - Enable the specified products (only those with valid price > 0)
    - Apply the specified markup percentage to them
    - Optionally set their category
    - Skip products without valid price
    """
    result = service.activate_selected_with_markup(data.product_ids, data.markup_percentage, data.category)
    msg = f"Activados {result['activated']} productos con markup de {data.markup_percentage}%"
    if data.category:
        msg += f" en categoria '{data.category}'"
    if result['skipped'] > 0:
        msg += f". Omitidos {result['skipped']} sin precio valido"
    return MessageResponse(message=msg)


@router.post(
    "/products/change-category-selected",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
async def change_category_selected(
    data: ProductChangeCategorySelected,
    service: ProductService = Depends(get_product_service),
):
    """
    Change category for selected products.
    """
    count = service.change_category_selected(data.product_ids, data.category)
    return MessageResponse(message=f"Categoria '{data.category}' asignada a {count} productos")


@router.post(
    "/products/disable-selected",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
async def disable_selected(
    data: ProductDisableSelected,
    service: ProductService = Depends(get_product_service),
):
    """
    Disable selected products.
    """
    count = service.disable_selected(data.product_ids)
    return MessageResponse(message=f"Deshabilitados {count} productos")


@router.post(
    "/source-websites/{source_id}/disable-all",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
async def disable_all_from_source(
    request: Request,
    source_id: int,
    service: ProductService = Depends(get_product_service),
):
    """
    Disable ALL products from a source website.
    """
    count = service.disable_all_from_source(source_id)
    return MessageResponse(message=f"Deshabilitados {count} productos de esta fuente")


@router.delete(
    "/source-websites/{source_id}/products",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
async def delete_all_products_from_source(
    request: Request,
    source_id: int,
    service: ProductService = Depends(get_product_service),
):
    """
    DELETE ALL products from a source website.
    Use with caution - this permanently removes all products.
    """
    count = service.delete_all_from_source(source_id)
    return MessageResponse(message=f"Eliminados {count} productos de esta fuente")


@router.post(
    "/source-websites/{source_id}/check-stock-all",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
async def check_stock_all_from_source(
    request: Request,
    source_id: int,
    service: ProductService = Depends(get_product_service),
):
    """
    Set is_check_stock=True for ALL enabled products from a source website.
    This also removes is_featured and is_immediate_delivery flags.
    """
    count = service.check_stock_all_from_source(source_id)
    return MessageResponse(message=f"Marcados {count} productos como 'Consultar stock'")


# ============================================
# Market Intelligence
# ============================================

@router.get(
    "/products/{product_id}/market-prices",
    response_model=MarketPriceStatsResponse,
    dependencies=[Depends(verify_admin)]
)
async def get_market_prices(
    product_id: int,
    service: MarketIntelligenceService = Depends(get_market_intelligence_service),
):
    """Get market price statistics for a product."""
    stats = service.get_stats(product_id)
    if not stats:
        return MarketPriceStatsResponse(product_id=product_id)
    return stats


@router.post(
    "/products/{product_id}/market-prices/refresh",
    response_model=MarketPriceStatsResponse,
    dependencies=[Depends(verify_admin)]
)
@limiter.limit("5/minute")
async def refresh_market_prices(
    request: Request,
    product_id: int,
    data: MarketPriceRefreshRequest = MarketPriceRefreshRequest(),
    service: MarketIntelligenceService = Depends(get_market_intelligence_service),
):
    """
    Refresh market prices for a product.

    Searches external sources (MercadoLibre, etc.) for similar products
    and updates price statistics.
    """
    return await service.refresh_market_prices(
        product_id,
        force=data.force,
        search_query=data.search_query
    )


@router.get(
    "/products/{product_id}/price-comparison",
    response_model=PriceComparisonResponse,
    dependencies=[Depends(verify_admin)]
)
async def get_price_comparison(
    product_id: int,
    service: MarketIntelligenceService = Depends(get_market_intelligence_service),
):
    """
    Get price comparison analysis.

    Shows how your price compares to market average, min, max
    with competitiveness indicator and recommendations.
    """
    return service.get_price_comparison(product_id)


# ============================================
# Bulk Operations
# ============================================

@router.post(
    "/source-websites/{source_id}/scrape-all",
    response_model=MessageResponse,
    dependencies=[Depends(verify_admin)]
)
@limiter.limit("2/hour")
async def scrape_all_products(
    request: Request,
    source_id: int,
    update_existing: bool = Query(default=True, description="Update existing products"),
    service: ProductService = Depends(get_product_service),
):
    """
    Scrape all products from a source website (synchronous).

    This operation:
    - Fetches all product slugs from the source catalog
    - Creates new products (disabled by default)
    - Optionally updates existing products with fresh data

    New products are created disabled - you must enable them manually.
    This can take several minutes depending on catalog size.

    NOTE: Use /scrape-job for background scraping with progress tracking.
    """
    results = await service.scrape_all_from_source(source_id, update_existing)

    return MessageResponse(
        message=f"Scrape complete: {results['new']} new, {results['updated']} updated, {results['errors']} errors (total: {results['total']})"
    )


# ============================================
# Background Scrape Jobs
# ============================================

@router.post(
    "/source-websites/{source_id}/scrape-job",
    dependencies=[Depends(verify_admin)]
)
async def start_scrape_job(
    request: Request,
    source_id: int,
    service: ProductService = Depends(get_product_service),
):
    """
    Start a background scrape job.

    Products are saved to the database as they're processed.
    Use GET /scrape-jobs/{job_id} to check progress.
    """
    from app.services.scrape_job import scrape_job_manager
    from app.db.session import SessionLocal

    # Verify source exists
    source = service.source_repo.get(source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Source website not found")

    # Check if already running
    active = scrape_job_manager.get_active_job_for_source(source.name)
    if active:
        return {
            "message": "Job already running",
            "job": active.to_dict()
        }

    # Start new job
    job = scrape_job_manager.start_job(
        source_name=source.name,
        source_website_id=source_id,
        db_session_factory=SessionLocal,
    )

    return {
        "message": "Scrape job started",
        "job": job.to_dict()
    }


@router.get(
    "/scrape-jobs",
    dependencies=[Depends(verify_admin)]
)
async def get_all_scrape_jobs(request: Request):
    """Get all scrape jobs (active and completed)."""
    from app.services.scrape_job import scrape_job_manager
    return {"jobs": scrape_job_manager.get_all_jobs()}


@router.get(
    "/scrape-jobs/{job_id}",
    dependencies=[Depends(verify_admin)]
)
async def get_scrape_job(request: Request, job_id: str):
    """Get scrape job progress by ID."""
    from app.services.scrape_job import scrape_job_manager

    job = scrape_job_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {"job": job.to_dict()}


@router.delete(
    "/scrape-jobs/{job_id}",
    dependencies=[Depends(verify_admin)]
)
async def cancel_scrape_job(request: Request, job_id: str):
    """Cancel a running scrape job."""
    from app.services.scrape_job import scrape_job_manager

    if scrape_job_manager.cancel_job(job_id):
        return {"message": "Job cancelled"}
    else:
        raise HTTPException(status_code=404, detail="Job not found or not running")


# ============================================
# PDF Export
# ============================================

@router.get(
    "/products/export/pdf",
    dependencies=[Depends(verify_admin)]
)
async def export_products_pdf(
    request: Request,
    format: str = Query(default="catalog", description="Format: 'catalog' (with images) or 'list' (simple)"),
    service: ProductService = Depends(get_product_service),
):
    """
    Export enabled products to PDF.

    Formats:
    - catalog: Full catalog with images, descriptions, prices (larger file)
    - list: Simple price list table (smaller file, faster)
    """
    # Get all enabled products
    products = service.get_enabled_products()

    if not products:
        raise HTTPException(status_code=404, detail="No enabled products to export")

    pdf_service = PDFGeneratorService()

    if format == "list":
        pdf_bytes = await pdf_service.generate_simple_catalog_pdf(
            products,
            title="Lista de Precios"
        )
        filename = "lista_precios.pdf"
    else:
        pdf_bytes = await pdf_service.generate_catalog_pdf(
            products,
            title="Catalogo de Productos",
            include_images=True
        )
        filename = "catalogo.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


# ============================================
# Price Comparator
# ============================================

@router.get(
    "/price-comparator",
    dependencies=[Depends(verify_admin)]
)
async def compare_prices(
    request: Request,
    search: str = Query(..., min_length=2, max_length=100, description="Search keyword"),
    service: ProductService = Depends(get_product_service),
):
    """
    Compare prices across source websites.

    Searches for products matching the keyword and returns
    prices from each source website for comparison.
    """
    results = service.compare_prices(search)
    return results


# ============================================
# Dashboard Stats
# ============================================

@router.get(
    "/stats/by-source-category",
    dependencies=[Depends(verify_admin)]
)
async def get_stats_by_source_and_category(
    request: Request,
    service: ProductService = Depends(get_product_service),
):
    """
    Get product stats grouped by source website and category.

    Returns counts of enabled/total products for each source-category combination.
    Used for dashboard overview and charts.
    """
    return service.get_stats_by_source_and_category()
