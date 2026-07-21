"""Admin endpoints for catalog sellers (vendedores del canal catálogo: ventas propias)."""
from typing import Optional

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.core.phone import normalizar_celular
from app.models.catalog_seller import CatalogSeller

router = APIRouter()


def _catalog_seller_dict(s: CatalogSeller) -> dict:
    return {
        "id": s.id,
        "nombre": s.nombre,
        "celular": s.celular,
        "bot_habilitado": s.bot_habilitado,
        "activo": s.activo,
    }


@router.get("/vendedores-catalogo")
async def list_catalog_sellers(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(CatalogSeller).filter(CatalogSeller.nombre != "Web")
    if activo is not None:
        q = q.filter(CatalogSeller.activo.is_(activo))
    return [_catalog_seller_dict(s) for s in q.order_by(CatalogSeller.nombre).all()]


@router.post("/vendedores-catalogo")
async def create_catalog_seller(
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    nombre = (body.get("nombre") or "").strip()
    if not nombre:
        raise HTTPException(400, "nombre es obligatorio")
    if db.query(CatalogSeller).filter(CatalogSeller.nombre == nombre).first():
        raise HTTPException(409, "Ya existe un vendedor con ese nombre")
    celular = (body.get("celular") or "").strip() or None
    s = CatalogSeller(
        nombre=nombre,
        celular=celular,
        celular_normalizado=normalizar_celular(celular) if celular else None,
        bot_habilitado=True,
        activo=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return _catalog_seller_dict(s)


@router.patch("/vendedores-catalogo/{seller_id}")
async def update_catalog_seller(
    seller_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    s = db.query(CatalogSeller).filter(CatalogSeller.id == seller_id).first()
    if not s:
        raise HTTPException(404, "Vendedor no encontrado")
    if body.get("nombre"):
        s.nombre = body["nombre"].strip()
    if "celular" in body:
        celular = (body.get("celular") or "").strip() or None
        s.celular = celular
        s.celular_normalizado = normalizar_celular(celular) if celular else None
    if "bot_habilitado" in body:
        s.bot_habilitado = bool(body["bot_habilitado"])
    if "activo" in body:
        s.activo = bool(body["activo"])
    db.commit()
    db.refresh(s)
    return _catalog_seller_dict(s)


@router.delete("/vendedores-catalogo/{seller_id}")
async def deactivate_catalog_seller(
    seller_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    s = db.query(CatalogSeller).filter(CatalogSeller.id == seller_id).first()
    if not s:
        raise HTTPException(404, "Vendedor no encontrado")
    s.activo = False
    db.commit()
    return {"ok": True}
