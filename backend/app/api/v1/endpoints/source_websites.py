"""Source Website management endpoints."""
from fastapi import APIRouter, Depends

from app.api.deps import get_source_website_service
from app.services.source_website import SourceWebsiteService
from app.schemas.source_website import (
    SourceWebsiteCreate,
    SourceWebsiteUpdate,
    SourceWebsiteResponse,
    SourceWebsiteListResponse,
)
from app.schemas.common import MessageResponse
from app.core.security import verify_admin

router = APIRouter()


@router.get(
    "",
    response_model=SourceWebsiteListResponse,
    dependencies=[Depends(verify_admin)]
)
async def get_source_websites(
    active_only: bool = False,
    service: SourceWebsiteService = Depends(get_source_website_service),
):
    """Get all source websites."""
    websites = service.get_all(active_only=active_only)

    items = []
    for w in websites:
        items.append(SourceWebsiteResponse(
            id=w.id,
            name=w.name,
            display_name=w.display_name,
            base_url=w.base_url,
            is_active=w.is_active,
            scraper_config=w.scraper_config,
            notes=w.notes,
            product_count=len(w.products) if w.products else 0,
            created_at=w.created_at,
            updated_at=w.updated_at,
        ))

    return SourceWebsiteListResponse(items=items, total=len(items))


@router.get(
    "/{website_id}",
    response_model=SourceWebsiteResponse,
    dependencies=[Depends(verify_admin)]
)
async def get_source_website(
    website_id: int,
    service: SourceWebsiteService = Depends(get_source_website_service),
):
    """Get a single source website."""
    w = service.get_by_id(website_id)
    return SourceWebsiteResponse(
        id=w.id,
        name=w.name,
        display_name=w.display_name,
        base_url=w.base_url,
        is_active=w.is_active,
        scraper_config=w.scraper_config,
        notes=w.notes,
        product_count=len(w.products) if w.products else 0,
        created_at=w.created_at,
        updated_at=w.updated_at,
    )


@router.post(
    "",
    response_model=SourceWebsiteResponse,
    status_code=201,
    dependencies=[Depends(verify_admin)]
)
async def create_source_website(
    data: SourceWebsiteCreate,
    service: SourceWebsiteService = Depends(get_source_website_service),
):
    """Create a new source website."""
    w = service.create(data)
    return SourceWebsiteResponse(
        id=w.id,
        name=w.name,
        display_name=w.display_name,
        base_url=w.base_url,
        is_active=w.is_active,
        scraper_config=w.scraper_config,
        notes=w.notes,
        product_count=0,
        created_at=w.created_at,
        updated_at=w.updated_at,
    )


@router.patch(
    "/{website_id}",
    response_model=SourceWebsiteResponse,
    dependencies=[Depends(verify_admin)]
)
async def update_source_website(
    website_id: int,
    data: SourceWebsiteUpdate,
    service: SourceWebsiteService = Depends(get_source_website_service),
):
    """Update a source website."""
    w = service.update(website_id, data)
    return SourceWebsiteResponse(
        id=w.id,
        name=w.name,
        display_name=w.display_name,
        base_url=w.base_url,
        is_active=w.is_active,
        scraper_config=w.scraper_config,
        notes=w.notes,
        product_count=len(w.products) if w.products else 0,
        created_at=w.created_at,
        updated_at=w.updated_at,
    )


@router.delete(
    "/{website_id}",
    status_code=204,
    dependencies=[Depends(verify_admin)]
)
async def delete_source_website(
    website_id: int,
    service: SourceWebsiteService = Depends(get_source_website_service),
):
    """Delete a source website."""
    service.delete(website_id)
