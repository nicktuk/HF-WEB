"""CRUD de ImportOutlet."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.outlet import ImportOutlet
from app.schemas.import_scorer.outlets import (
    ImportOutletCreate,
    ImportOutletUpdate,
    ImportOutletResponse,
)

router = APIRouter()


@router.get("", response_model=List[ImportOutletResponse])
def list_outlets(
    activo: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(ImportOutlet)
    if activo is not None:
        q = q.filter(ImportOutlet.activo == activo)
    return q.order_by(ImportOutlet.nombre).all()


@router.post("", response_model=ImportOutletResponse, status_code=201)
def create_outlet(
    data: ImportOutletCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    if db.query(ImportOutlet).filter(ImportOutlet.nombre == data.nombre).first():
        raise HTTPException(status_code=409, detail="Ya existe un outlet con ese nombre")

    outlet = ImportOutlet(**data.model_dump())
    db.add(outlet)
    db.commit()
    db.refresh(outlet)
    return outlet


@router.get("/{outlet_id}", response_model=ImportOutletResponse)
def get_outlet(
    outlet_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    outlet = db.query(ImportOutlet).filter(ImportOutlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet no encontrado")
    return outlet


@router.put("/{outlet_id}", response_model=ImportOutletResponse)
def update_outlet(
    outlet_id: str,
    data: ImportOutletUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    outlet = db.query(ImportOutlet).filter(ImportOutlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet no encontrado")

    if data.nombre and data.nombre != outlet.nombre:
        if db.query(ImportOutlet).filter(ImportOutlet.nombre == data.nombre).first():
            raise HTTPException(status_code=409, detail="Ya existe un outlet con ese nombre")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(outlet, field, value)

    db.commit()
    db.refresh(outlet)
    return outlet


@router.delete("/{outlet_id}", status_code=204)
def delete_outlet(
    outlet_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    outlet = db.query(ImportOutlet).filter(ImportOutlet.id == outlet_id).first()
    if not outlet:
        raise HTTPException(status_code=404, detail="Outlet no encontrado")
    db.delete(outlet)
    db.commit()
