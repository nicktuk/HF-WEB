"""Radar de tendencias: AR + USA."""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.trend_snapshot import ImportTrendSnapshot
from app.services.import_scorer.trends import actualizar_trends_todos, actualizar_trends_rubro

router = APIRouter()


@router.get("")
def get_radar(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Devuelve todos los snapshots de trends para el radar."""
    rubros = db.query(ImportRubro).filter(ImportRubro.activo == True).all()
    snapshots = {
        s.rubro_id: s
        for s in db.query(ImportTrendSnapshot).all()
    }

    result = []
    for rubro in rubros:
        snap = snapshots.get(rubro.id)
        result.append({
            "rubro_id": rubro.id,
            "rubro_nombre": rubro.nombre,
            "keyword": snap.keyword if snap else (rubro.palabras_busqueda_usa or [None])[0],
            "data_ar": snap.data_ar if snap else [],
            "data_usa": snap.data_usa if snap else [],
            "score_ar": snap.score_ar if snap else None,
            "score_usa": snap.score_usa if snap else None,
            "tendencia_ar": snap.tendencia_ar if snap else "sin_datos",
            "tendencia_usa": snap.tendencia_usa if snap else "sin_datos",
            "updated_at": snap.updated_at.isoformat() if snap and snap.updated_at else None,
        })

    # Ordenar: primero los que están subiendo en USA (oportunidad de anticipación)
    result.sort(key=lambda x: (
        x["tendencia_usa"] != "subiendo",
        -(x["score_usa"] or 0),
    ))
    return result


@router.post("/actualizar")
async def actualizar_radar(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Dispara actualización de trends en background."""
    background_tasks.add_task(actualizar_trends_todos, db)
    return {"status": "iniciado"}


@router.post("/actualizar/{rubro_id}")
async def actualizar_radar_rubro(
    rubro_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Actualiza trends para un rubro específico (sincrónico)."""
    rubro = db.query(ImportRubro).filter(ImportRubro.id == rubro_id).first()
    if not rubro:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    result = await actualizar_trends_rubro(db, rubro)
    return result
