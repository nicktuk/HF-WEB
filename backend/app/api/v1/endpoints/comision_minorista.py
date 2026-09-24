"""Admin: configuración de la comisión minorista (canal ventas propias).

Matriz semanal de tramos por monto, cálculo escalonado o sobre toda la
venta, y % para productos en oferta — ver services/comisiones.py. Los dos
valores sueltos viven en la fila única de ConfiguracionComercio (tabla
general de configuración), pero se administran acá, fuera de /comercios.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.comercio import ComisionMinoristaTramo, ConfiguracionComercio
from app.services import comisiones

router = APIRouter()


def _config_dict(db: Session, cfg: ConfiguracionComercio) -> dict:
    tramos = db.query(ComisionMinoristaTramo).order_by(ComisionMinoristaTramo.monto_desde).all()
    return {
        "tramos": [{"monto_desde": float(t.monto_desde), "porcentaje": float(t.porcentaje)} for t in tramos],
        "oferta_porcentaje": float(cfg.comision_minorista_oferta_porcentaje),
        "escalonada": bool(cfg.comision_minorista_escalonada),
    }


def _get_config(db: Session) -> ConfiguracionComercio:
    cfg = db.query(ConfiguracionComercio).first()
    if not cfg:
        raise HTTPException(404, "Configuración no encontrada")
    return cfg


@router.get("/comision-minorista")
async def get_comision_minorista(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    return _config_dict(db, _get_config(db))


@router.put("/comision-minorista")
async def set_comision_minorista(
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Reemplaza toda la configuración minorista (matriz completa + % de
    ofertas + escalonado). Tiene que haber un tramo desde $0. Se recalcula
    la semana en curso; las semanas cerradas quedan como estaban."""
    cfg = _get_config(db)

    montos_vistos: set[float] = set()
    nuevos: list[ComisionMinoristaTramo] = []
    for row in body.get("tramos") or []:
        monto = float(row.get("monto_desde", 0))
        porcentaje = float(row.get("porcentaje", 0))
        if monto < 0:
            raise HTTPException(400, "monto_desde debe ser >= 0")
        if porcentaje < 0 or porcentaje > 100:
            raise HTTPException(400, "porcentaje debe estar entre 0 y 100")
        if monto in montos_vistos:
            raise HTTPException(400, f"monto_desde {monto:g} está repetido")
        montos_vistos.add(monto)
        nuevos.append(ComisionMinoristaTramo(monto_desde=monto, porcentaje=porcentaje))
    if 0 not in montos_vistos:
        raise HTTPException(400, "La matriz tiene que tener un tramo desde $0")

    oferta = float(body.get("oferta_porcentaje", 0))
    if oferta < 0 or oferta > 100:
        raise HTTPException(400, "oferta_porcentaje debe estar entre 0 y 100")

    cfg.comision_minorista_oferta_porcentaje = oferta
    cfg.comision_minorista_escalonada = bool(body.get("escalonada"))
    db.query(ComisionMinoristaTramo).delete()
    db.add_all(nuevos)
    db.flush()
    comisiones.recalcular_semana_actual(db)
    db.commit()
    db.refresh(cfg)
    return _config_dict(db, cfg)
