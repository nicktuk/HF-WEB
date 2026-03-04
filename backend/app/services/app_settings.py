"""Servicio para gestionar configuraciones de la aplicación en DB."""
from typing import Optional
from sqlalchemy.orm import Session

from app.config import settings
from app.models.app_setting import AppSetting


def get_setting(db: Session, key: str, default: Optional[str] = None) -> Optional[str]:
    """Obtiene un valor de configuración desde DB."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row is None or row.value is None:
        return default
    return row.value


def set_setting(db: Session, key: str, value: Optional[str]) -> None:
    """Guarda o actualiza un valor de configuración en DB."""
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if row is None:
        row = AppSetting(key=key, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()


def get_ai_config(db: Session) -> dict:
    """
    Devuelve la configuración de IA activa.
    La DB tiene prioridad; cae a settings.* si no hay valor en DB.
    """
    provider = get_setting(db, "AI_PROVIDER") or settings.AI_PROVIDER
    anthropic_key = get_setting(db, "ANTHROPIC_API_KEY") or settings.ANTHROPIC_API_KEY
    openai_key = get_setting(db, "OPENAI_API_KEY") or settings.OPENAI_API_KEY
    brave_key = get_setting(db, "BRAVE_SEARCH_API_KEY") or settings.BRAVE_SEARCH_API_KEY
    batch_concurrency_str = get_setting(db, "AI_BATCH_CONCURRENCY")
    if batch_concurrency_str is not None:
        try:
            batch_concurrency = int(batch_concurrency_str)
        except ValueError:
            batch_concurrency = settings.AI_BATCH_CONCURRENCY
    else:
        batch_concurrency = settings.AI_BATCH_CONCURRENCY

    return {
        "AI_PROVIDER": provider,
        "ANTHROPIC_API_KEY": anthropic_key,
        "OPENAI_API_KEY": openai_key,
        "BRAVE_SEARCH_API_KEY": brave_key,
        "AI_BATCH_CONCURRENCY": batch_concurrency,
    }
