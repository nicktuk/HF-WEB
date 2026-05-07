"""Endpoints de productos Import Scorer."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.producto import ImportProducto, ImportOfertaRetailer
from app.models.import_scorer.retailer import ImportRetailer
from app.models.import_scorer.rubro import ImportRubro
from app.schemas.import_scorer.productos import (
    ImportProductoUpdate,
    ImportProductoResponse,
    ImportOfertaResponse,
)
from app.services.import_scorer.mep import get_mep_rate

router = APIRouter()


def _build_response(producto: ImportProducto, db: Session) -> ImportProductoResponse:
    rubro = db.query(ImportRubro).filter(ImportRubro.id == producto.rubro_id).first()
    mejor_retailer = None
    if producto.mejor_retailer_id:
        mejor_retailer = db.query(ImportRetailer).filter(
            ImportRetailer.id == producto.mejor_retailer_id
        ).first()

    ofertas_resp = []
    for o in producto.ofertas_usa:
        r = db.query(ImportRetailer).filter(ImportRetailer.id == o.retailer_id).first()
        ofertas_resp.append(ImportOfertaResponse(
            id=o.id,
            retailer_id=o.retailer_id,
            retailer_nombre=r.nombre if r else None,
            precio_usd=o.precio_usd,
            url=o.url,
            en_clearance=o.en_clearance,
            en_stock=o.en_stock,
            envio_gratis=o.envio_gratis,
            fecha=o.fecha,
        ))

    resp = ImportProductoResponse.model_validate(producto)
    resp.rubro_nombre = rubro.nombre if rubro else None
    resp.mejor_retailer_nombre = mejor_retailer.nombre if mejor_retailer else None
    resp.ofertas = ofertas_resp
    return resp


@router.get("", response_model=List[ImportProductoResponse])
def list_productos(
    rubro_id: Optional[str] = None,
    semaforo: Optional[str] = None,
    solo_pinned: bool = False,
    incluir_descartados: bool = False,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    query = db.query(ImportProducto)
    if not incluir_descartados:
        query = query.filter(ImportProducto.descartado == False)
    if rubro_id:
        query = query.filter(ImportProducto.rubro_id == rubro_id)
    if semaforo:
        query = query.filter(ImportProducto.semaforo == semaforo)
    if solo_pinned:
        query = query.filter(ImportProducto.pinned == True)
    if q:
        query = query.filter(ImportProducto.nombre.ilike(f"%{q}%"))

    productos = (
        query.order_by(
            ImportProducto.pinned.desc(),
            ImportProducto.semaforo,
            ImportProducto.ratio_margen.desc().nullslast(),
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    return [_build_response(p, db) for p in productos]


@router.get("/{producto_id}", response_model=ImportProductoResponse)
def get_producto(
    producto_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    p = db.query(ImportProducto).filter(ImportProducto.id == producto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return _build_response(p, db)


@router.put("/{producto_id}", response_model=ImportProductoResponse)
def update_producto(
    producto_id: str,
    data: ImportProductoUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    p = db.query(ImportProducto).filter(ImportProducto.id == producto_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(p, field, value)
    db.commit()
    db.refresh(p)
    return _build_response(p, db)


@router.post("/recalcular-scoring")
async def recalcular_scoring(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Recalcula scoring de todos los productos con el MEP actual."""
    from app.services.import_scorer.scoring import recalcular_scoring as _recalc
    try:
        mep = await get_mep_rate()
        cotizacion = mep["cotizacion"]
    except Exception:
        raise HTTPException(status_code=503, detail="No se pudo obtener la cotización MEP")

    resultado = await _recalc(db, cotizacion)
    return {"status": "completado", **resultado}
