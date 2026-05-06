"""Dashboard y cotización MEP."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.config import ImportConfig
from app.models.import_scorer.scrape_log import ImportScrapeLog
from app.models.import_scorer.carrito import ImportCarrito
from app.schemas.import_scorer.common import MepRateResponse
from app.services.import_scorer.mep import get_mep_rate, invalidate_mep_cache

router = APIRouter()


@router.get("/mep", response_model=MepRateResponse)
async def get_mep(
    _: bool = Depends(verify_admin),
):
    """Devuelve la cotización MEP actual (cacheada 30 min)."""
    try:
        return await get_mep_rate()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.post("/mep/refresh", response_model=MepRateResponse)
async def refresh_mep(
    _: bool = Depends(verify_admin),
):
    """Fuerza refresco de la cotización MEP."""
    invalidate_mep_cache()
    try:
        return await get_mep_rate()
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.get("/resumen")
def get_resumen(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Resumen para el dashboard: última corrida, carritos activos."""
    ultima_corrida = (
        db.query(ImportScrapeLog)
        .order_by(ImportScrapeLog.fecha.desc())
        .first()
    )
    carritos_activos = (
        db.query(ImportCarrito)
        .filter(ImportCarrito.estado.in_(["borrador", "cotizado"]))
        .filter(ImportCarrito.es_plantilla == False)
        .count()
    )
    config = db.query(ImportConfig).first()

    return {
        "ultima_corrida": {
            "fecha": ultima_corrida.fecha.isoformat() if ultima_corrida else None,
            "fuente": ultima_corrida.fuente if ultima_corrida else None,
            "productos_act": ultima_corrida.productos_act if ultima_corrida else 0,
            "errores": ultima_corrida.errores if ultima_corrida else 0,
        },
        "carritos_activos": carritos_activos,
        "config": {
            "costo_flete_usd_por_kg": config.costo_flete_usd_por_kg if config else 50.0,
            "sales_tax_fl": config.sales_tax_fl if config else 0.07,
        },
    }
