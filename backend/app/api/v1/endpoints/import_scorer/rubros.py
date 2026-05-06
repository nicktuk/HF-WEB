"""CRUD de ImportRubro."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.producto import ImportProducto
from app.schemas.import_scorer.rubros import (
    ImportRubroCreate,
    ImportRubroUpdate,
    ImportRubroResponse,
)

router = APIRouter()


def _to_response(rubro: ImportRubro, db: Session) -> ImportRubroResponse:
    total = db.query(func.count(ImportProducto.id)).filter(ImportProducto.rubro_id == rubro.id).scalar() or 0
    data = ImportRubroResponse.model_validate(rubro)
    data.total_productos = total
    return data


@router.get("", response_model=List[ImportRubroResponse])
def list_rubros(
    activo: Optional[bool] = None,
    template_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(ImportRubro)
    if activo is not None:
        q = q.filter(ImportRubro.activo == activo)
    if template_id:
        q = q.filter(ImportRubro.template_id == template_id)
    rubros = q.order_by(ImportRubro.nombre).all()
    return [_to_response(r, db) for r in rubros]


@router.post("", response_model=ImportRubroResponse, status_code=201)
def create_rubro(
    data: ImportRubroCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    if db.query(ImportRubro).filter(ImportRubro.nombre == data.nombre).first():
        raise HTTPException(status_code=409, detail="Ya existe un rubro con ese nombre")

    rubro = ImportRubro(**data.model_dump())
    db.add(rubro)
    db.commit()
    db.refresh(rubro)
    return _to_response(rubro, db)


@router.get("/{rubro_id}", response_model=ImportRubroResponse)
def get_rubro(
    rubro_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    rubro = db.query(ImportRubro).filter(ImportRubro.id == rubro_id).first()
    if not rubro:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    return _to_response(rubro, db)


@router.put("/{rubro_id}", response_model=ImportRubroResponse)
def update_rubro(
    rubro_id: str,
    data: ImportRubroUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    rubro = db.query(ImportRubro).filter(ImportRubro.id == rubro_id).first()
    if not rubro:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")

    if data.nombre and data.nombre != rubro.nombre:
        if db.query(ImportRubro).filter(ImportRubro.nombre == data.nombre).first():
            raise HTTPException(status_code=409, detail="Ya existe un rubro con ese nombre")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(rubro, field, value)

    db.commit()
    db.refresh(rubro)
    return _to_response(rubro, db)


@router.delete("/{rubro_id}", status_code=204)
def delete_rubro(
    rubro_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    rubro = db.query(ImportRubro).filter(ImportRubro.id == rubro_id).first()
    if not rubro:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    if rubro.productos:
        raise HTTPException(status_code=409, detail="No se puede eliminar un rubro con productos asociados")
    db.delete(rubro)
    db.commit()
