"""Endpoint de scraping manual y cron para Import Scorer."""
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.config import settings

router = APIRouter()


def _check_cron_secret(x_cron_secret: Optional[str]) -> bool:
    cron_secret = getattr(settings, "IMPORT_SCORER_CRON_SECRET", "")
    return bool(cron_secret and x_cron_secret == cron_secret)


@router.post("")
async def trigger_scrape(
    background_tasks: BackgroundTasks,
    x_cron_secret: Optional[str] = Header(None),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Dispara scraping completo (todos los rubros activos).
    Acepta X-Cron-Secret para llamadas desde Railway Cron (sin API key admin).
    """
    from app.services.import_scorer.dispatcher import ejecutar_scraping_completo
    from app.services.import_scorer.mep import get_mep_rate
    from app.services.import_scorer.scoring import recalcular_scoring
    from app.services.import_scorer.email_alerts import enviar_resumen_scraping

    async def _run():
        resultado = await ejecutar_scraping_completo(db)
        try:
            mep = await get_mep_rate()
            await recalcular_scoring(db, mep["cotizacion"])
        except Exception:
            pass
        enviar_resumen_scraping(resultado)

    background_tasks.add_task(_run)
    return {"status": "iniciado", "mensaje": "Scraping en background"}


@router.post("/rubro/{rubro_id}")
async def trigger_scrape_rubro(
    rubro_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Dispara scraping solo para un rubro específico."""
    from app.services.import_scorer.dispatcher import ejecutar_scraping_rubro
    background_tasks.add_task(ejecutar_scraping_rubro, db, rubro_id)
    return {"status": "iniciado", "rubro_id": rubro_id}
