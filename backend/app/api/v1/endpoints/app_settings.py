"""
Endpoints para configuración de la aplicación desde el panel admin.

GET /admin/settings/ai  → devuelve config de IA con claves enmascaradas
PUT /admin/settings/ai  → actualiza config de IA en DB
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
