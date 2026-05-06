"""CRUD de ImportRetailer."""
import importlib
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.retailer import ImportRetailer
from app.schemas.import_scorer.retailers import (
    ImportRetailerCreate,
    ImportRetailerUpdate,
    ImportRetailerResponse,
)

router = APIRouter()

SCRAPERS_MODULE_BASE = "app.scrapers.import_scorer"


def _scraper_disponible(slug: str) -> bool:
    """Verifica si existe implementación de scraper para el slug dado."""
    if not slug:
        return False
    try:
        importlib.import_module(f"{SCRAPERS_MODULE_BASE}.{slug}")
        return True
    except ImportError:
        return False


def _to_response(retailer: ImportRetailer) -> ImportRetailerResponse:
    data = ImportRetailerResponse.model_validate(retailer)
    data.scraper_disponible = _scraper_disponible(retailer.scraper_implementacion)
    return data


@router.get("", response_model=List[ImportRetailerResponse])
def list_retailers(
    activo: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(ImportRetailer)
    if activo is not None:
        q = q.filter(ImportRetailer.activo == activo)
    retailers = q.order_by(ImportRetailer.nombre).all()
    return [_to_response(r) for r in retailers]


@router.post("", response_model=ImportRetailerResponse, status_code=201)
def create_retailer(
    data: ImportRetailerCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    if db.query(ImportRetailer).filter(ImportRetailer.slug == data.slug).first():
        raise HTTPException(status_code=409, detail="Ya existe un retailer con ese slug")
    if db.query(ImportRetailer).filter(ImportRetailer.nombre == data.nombre).first():
        raise HTTPException(status_code=409, detail="Ya existe un retailer con ese nombre")

    retailer = ImportRetailer(**data.model_dump())
    db.add(retailer)
    db.commit()
    db.refresh(retailer)
    return _to_response(retailer)


@router.get("/{retailer_id}", response_model=ImportRetailerResponse)
def get_retailer(
    retailer_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    retailer = db.query(ImportRetailer).filter(ImportRetailer.id == retailer_id).first()
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer no encontrado")
    return _to_response(retailer)


@router.put("/{retailer_id}", response_model=ImportRetailerResponse)
def update_retailer(
    retailer_id: str,
    data: ImportRetailerUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    retailer = db.query(ImportRetailer).filter(ImportRetailer.id == retailer_id).first()
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer no encontrado")

    if data.nombre and data.nombre != retailer.nombre:
        if db.query(ImportRetailer).filter(ImportRetailer.nombre == data.nombre).first():
            raise HTTPException(status_code=409, detail="Ya existe un retailer con ese nombre")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(retailer, field, value)

    db.commit()
    db.refresh(retailer)
    return _to_response(retailer)


@router.delete("/{retailer_id}", status_code=204)
def delete_retailer(
    retailer_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    retailer = db.query(ImportRetailer).filter(ImportRetailer.id == retailer_id).first()
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer no encontrado")
    db.delete(retailer)
    db.commit()


@router.post("/{retailer_id}/pausar", response_model=ImportRetailerResponse)
def pausar_retailer(
    retailer_id: str,
    horas: int = 6,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Pausa un retailer por N horas (default 6)."""
    from datetime import datetime, timedelta
    retailer = db.query(ImportRetailer).filter(ImportRetailer.id == retailer_id).first()
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer no encontrado")
    retailer.pausado_hasta = datetime.utcnow() + timedelta(hours=horas)
    db.commit()
    db.refresh(retailer)
    return _to_response(retailer)


@router.post("/{retailer_id}/reactivar", response_model=ImportRetailerResponse)
def reactivar_retailer(
    retailer_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    retailer = db.query(ImportRetailer).filter(ImportRetailer.id == retailer_id).first()
    if not retailer:
        raise HTTPException(status_code=404, detail="Retailer no encontrado")
    retailer.pausado_hasta = None
    retailer.ultimo_error = None
    db.commit()
    db.refresh(retailer)
    return _to_response(retailer)
