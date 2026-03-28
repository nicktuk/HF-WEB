"""
Endpoints para configuración de la aplicación desde el panel admin.

GET /admin/settings/ai       → devuelve config de IA con claves enmascaradas
PUT /admin/settings/ai       → actualiza config de IA en DB
GET /admin/settings/catalog  → devuelve config del catálogo público
PUT /admin/settings/catalog  → actualiza config del catálogo público
GET /catalog-settings        → (público) devuelve config del catálogo
"""
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import verify_admin
from app.db.session import get_db
from app.services.app_settings import get_setting, set_setting

router = APIRouter()

_MASK_PREFIX = "****"


def _mask_key(value: Optional[str]) -> str:
    """Enmascara una API key mostrando solo los últimos 6 caracteres."""
    if not value:
        return ""
    if len(value) <= 6:
        return _MASK_PREFIX
    return f"{_MASK_PREFIX}...{value[-6:]}"


def _is_masked(value: Optional[str]) -> bool:
    """Devuelve True si el valor es una máscara (no fue modificado por el usuario)."""
    return value is not None and value.startswith(_MASK_PREFIX)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class AISettingsResponse(BaseModel):
    provider: str
    anthropic_key: str
    openai_key: str
    brave_key: str
    batch_concurrency: int
    prompt_extra: str


class AISettingsUpdate(BaseModel):
    provider: Optional[str] = None
    anthropic_key: Optional[str] = None
    openai_key: Optional[str] = None
    brave_key: Optional[str] = None
    batch_concurrency: Optional[int] = None
    prompt_extra: Optional[str] = None


# ---------------------------------------------------------------------------
# GET /ai
# ---------------------------------------------------------------------------

@router.get("/ai", response_model=AISettingsResponse, dependencies=[Depends(verify_admin)])
def get_ai_settings(db: Session = Depends(get_db)) -> AISettingsResponse:
    provider = get_setting(db, "AI_PROVIDER") or settings.AI_PROVIDER
    anthropic_key = get_setting(db, "ANTHROPIC_API_KEY") or settings.ANTHROPIC_API_KEY
    openai_key = get_setting(db, "OPENAI_API_KEY") or settings.OPENAI_API_KEY
    brave_key = get_setting(db, "BRAVE_SEARCH_API_KEY") or settings.BRAVE_SEARCH_API_KEY
    batch_concurrency_str = get_setting(db, "AI_BATCH_CONCURRENCY")
    batch_concurrency = (
        int(batch_concurrency_str)
        if batch_concurrency_str is not None
        else settings.AI_BATCH_CONCURRENCY
    )

    prompt_extra = get_setting(db, "AI_PROMPT_EXTRA") or ""

    return AISettingsResponse(
        provider=provider,
        anthropic_key=_mask_key(anthropic_key),
        openai_key=_mask_key(openai_key),
        brave_key=_mask_key(brave_key),
        batch_concurrency=batch_concurrency,
        prompt_extra=prompt_extra,
    )


# ---------------------------------------------------------------------------
# PUT /ai
# ---------------------------------------------------------------------------

@router.put("/ai", response_model=AISettingsResponse, dependencies=[Depends(verify_admin)])
def update_ai_settings(
    data: AISettingsUpdate,
    db: Session = Depends(get_db),
) -> AISettingsResponse:
    if data.provider is not None:
        set_setting(db, "AI_PROVIDER", data.provider)

    # Solo actualizar la clave si no está enmascarada (fue modificada por el usuario)
    if data.anthropic_key is not None and not _is_masked(data.anthropic_key):
        set_setting(db, "ANTHROPIC_API_KEY", data.anthropic_key or None)

    if data.openai_key is not None and not _is_masked(data.openai_key):
        set_setting(db, "OPENAI_API_KEY", data.openai_key or None)

    if data.brave_key is not None and not _is_masked(data.brave_key):
        set_setting(db, "BRAVE_SEARCH_API_KEY", data.brave_key or None)

    if data.batch_concurrency is not None:
        set_setting(db, "AI_BATCH_CONCURRENCY", str(data.batch_concurrency))

    if data.prompt_extra is not None:
        set_setting(db, "AI_PROMPT_EXTRA", data.prompt_extra.strip() or None)

    # Devolver estado actualizado (enmascarado)
    return get_ai_settings(db=db)


# ---------------------------------------------------------------------------
# Schemas catálogo
# ---------------------------------------------------------------------------

FEATURED_PILL_DEFAULT = "Nuevos ingresos"
STOCK_LOW_THRESHOLD_DEFAULT = 5


class CatalogSettingsResponse(BaseModel):
    featured_pill_label: str
    stock_low_threshold: int
    show_by_sections: bool = False
    group_by_category: bool = True
    section_sort_order: str = "asc"
    show_out_of_stock: bool = True


class CatalogSettingsUpdate(BaseModel):
    featured_pill_label: Optional[str] = None
    stock_low_threshold: Optional[int] = None
    show_by_sections: Optional[bool] = None
    group_by_category: Optional[bool] = None
    section_sort_order: Optional[str] = None
    show_out_of_stock: Optional[bool] = None


# ---------------------------------------------------------------------------
# GET /catalog  (admin)
# ---------------------------------------------------------------------------

@router.get("/catalog", response_model=CatalogSettingsResponse, dependencies=[Depends(verify_admin)])
def get_catalog_settings(db: Session = Depends(get_db)) -> CatalogSettingsResponse:
    featured_label = get_setting(db, "FEATURED_PILL_LABEL") or FEATURED_PILL_DEFAULT
    threshold_str = get_setting(db, "STOCK_LOW_THRESHOLD")
    threshold = int(threshold_str) if threshold_str is not None else STOCK_LOW_THRESHOLD_DEFAULT
    show_by_sections_str = get_setting(db, "SHOW_BY_SECTIONS")
    show_by_sections = show_by_sections_str == "true" if show_by_sections_str is not None else False
    group_by_category_str = get_setting(db, "GROUP_BY_CATEGORY")
    group_by_category = group_by_category_str != "false" if group_by_category_str is not None else True
    section_sort_order = get_setting(db, "SECTION_SORT_ORDER") or "asc"
    show_out_of_stock_str = get_setting(db, "SHOW_OUT_OF_STOCK")
    show_out_of_stock = show_out_of_stock_str != "false" if show_out_of_stock_str is not None else True
    return CatalogSettingsResponse(
        featured_pill_label=featured_label,
        stock_low_threshold=threshold,
        show_by_sections=show_by_sections,
        group_by_category=group_by_category,
        section_sort_order=section_sort_order,
        show_out_of_stock=show_out_of_stock,
    )


# ---------------------------------------------------------------------------
# PUT /catalog  (admin)
# ---------------------------------------------------------------------------

@router.put("/catalog", response_model=CatalogSettingsResponse, dependencies=[Depends(verify_admin)])
def update_catalog_settings(
    data: CatalogSettingsUpdate,
    db: Session = Depends(get_db),
) -> CatalogSettingsResponse:
    if data.featured_pill_label is not None:
        label = data.featured_pill_label.strip() or FEATURED_PILL_DEFAULT
        set_setting(db, "FEATURED_PILL_LABEL", label)
    if data.stock_low_threshold is not None:
        set_setting(db, "STOCK_LOW_THRESHOLD", str(max(0, data.stock_low_threshold)))
    if data.show_by_sections is not None:
        set_setting(db, "SHOW_BY_SECTIONS", "true" if data.show_by_sections else "false")
    if data.group_by_category is not None:
        set_setting(db, "GROUP_BY_CATEGORY", "true" if data.group_by_category else "false")
    if data.section_sort_order is not None:
        set_setting(db, "SECTION_SORT_ORDER", "desc" if data.section_sort_order == "desc" else "asc")
    if data.show_out_of_stock is not None:
        set_setting(db, "SHOW_OUT_OF_STOCK", "true" if data.show_out_of_stock else "false")
    return get_catalog_settings(db=db)


# ---------------------------------------------------------------------------
# GET /public/catalog-settings  (sin auth)
# ---------------------------------------------------------------------------

@router.get("/public/catalog-settings")
def get_public_catalog_settings(db: Session = Depends(get_db)):
    featured_label = get_setting(db, "FEATURED_PILL_LABEL") or FEATURED_PILL_DEFAULT
    threshold_str = get_setting(db, "STOCK_LOW_THRESHOLD")
    threshold = int(threshold_str) if threshold_str is not None else STOCK_LOW_THRESHOLD_DEFAULT
    show_by_sections_str = get_setting(db, "SHOW_BY_SECTIONS")
    show_by_sections = show_by_sections_str == "true" if show_by_sections_str is not None else False
    group_by_category_str = get_setting(db, "GROUP_BY_CATEGORY")
    group_by_category = group_by_category_str != "false" if group_by_category_str is not None else True
    section_sort_order = get_setting(db, "SECTION_SORT_ORDER") or "asc"
    show_out_of_stock_str = get_setting(db, "SHOW_OUT_OF_STOCK")
    show_out_of_stock = show_out_of_stock_str != "false" if show_out_of_stock_str is not None else True
    return {
        "featured_pill_label": featured_label,
        "stock_low_threshold": threshold,
        "show_by_sections": show_by_sections,
        "group_by_category": group_by_category,
        "section_sort_order": section_sort_order,
        "show_out_of_stock": show_out_of_stock,
    }
