"""Endpoint de scraping manual/cron — stub para paso 2, implementación completa en paso 9."""
from fastapi import APIRouter, Depends, Header
from typing import Optional
from app.core.security import verify_admin
from app.config import settings

router = APIRouter()


@router.post("")
async def trigger_scrape(
    x_cron_secret: Optional[str] = Header(None),
    _: bool = Depends(verify_admin),
):
    """
    Dispara el proceso de scraping.
    Acepta header X-Cron-Secret para Railway Cron (sin API key).
    """
    if x_cron_secret:
        cron_secret = getattr(settings, "IMPORT_SCORER_CRON_SECRET", "")
        if not cron_secret or x_cron_secret != cron_secret:
            from fastapi import HTTPException
            raise HTTPException(status_code=401, detail="Cron secret inválido")

    return {"status": "pendiente de implementación", "mensaje": "Scraping no implementado aún"}
