"""Analytics y calibración de Import Scorer."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.producto import ImportProducto, ImportCarritoItem
from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.carrito import ImportCarrito, ImportCarritoItem as CI
from app.models.import_scorer.scrape_log import ImportScrapeLog

router = APIRouter()


@router.get("")
def get_analytics(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Estadísticas generales del sistema."""
    total = db.query(func.count(ImportProducto.id)).filter(ImportProducto.descartado == False).scalar() or 0
    por_semaforo = (
        db.query(ImportProducto.semaforo, func.count(ImportProducto.id))
        .filter(ImportProducto.descartado == False, ImportProducto.semaforo != None)
        .group_by(ImportProducto.semaforo)
        .all()
    )
    semaforo_dict = {s: c for s, c in por_semaforo}

    # Por rubro
    por_rubro = (
        db.query(ImportRubro.nombre, func.count(ImportProducto.id))
        .join(ImportProducto, ImportProducto.rubro_id == ImportRubro.id)
        .filter(ImportProducto.descartado == False)
        .group_by(ImportRubro.nombre)
        .order_by(func.count(ImportProducto.id).desc())
        .limit(10)
        .all()
    )

    # Carritos activos
    carritos_activos = (
        db.query(func.count(ImportCarrito.id))
        .filter(ImportCarrito.estado.in_(["borrador", "cotizado"]))
        .filter(ImportCarrito.es_plantilla == False)
        .scalar() or 0
    )

    # Últimos scrape logs
    logs = (
        db.query(ImportScrapeLog)
        .order_by(ImportScrapeLog.fecha.desc())
        .limit(5)
        .all()
    )

    return {
        "total_productos": total,
        "por_semaforo": semaforo_dict,
        "por_rubro": [{"rubro": r, "productos": c} for r, c in por_rubro],
        "carritos_activos": carritos_activos,
        "scrape_logs": [
            {
                "fecha": l.fecha.isoformat(),
                "fuente": l.fuente,
                "productos_act": l.productos_act,
                "errores": l.errores,
                "duracion_ms": l.duracion_ms,
            }
            for l in logs
        ],
    }


@router.get("/calibracion")
def get_calibracion(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Calibración del scoring: margen real vs estimado en productos ya importados."""
    productos = (
        db.query(ImportProducto)
        .filter(ImportProducto.veces_importado > 0)
        .filter(ImportProducto.margen_real_promedio != None)
        .order_by(ImportProducto.veces_importado.desc())
        .limit(50)
        .all()
    )

    items = []
    errores_totales = []
    for p in productos:
        error = None
        if p.ratio_margen and p.margen_real_promedio:
            error = round(p.ratio_margen - p.margen_real_promedio, 3)
            errores_totales.append(abs(error))
        items.append({
            "id": p.id,
            "nombre": p.nombre,
            "semaforo": p.semaforo,
            "ratio_estimado": p.ratio_margen,
            "margen_real": p.margen_real_promedio,
            "error": error,
            "veces_importado": p.veces_importado,
            "dias_promedio_venta": p.dias_promedio_venta,
        })

    mae = round(sum(errores_totales) / len(errores_totales), 3) if errores_totales else None

    return {
        "productos": items,
        "n_calibracion": len(items),
        "mae": mae,
        "descripcion": "MAE = error absoluto medio entre ratio estimado y margen real",
    }
