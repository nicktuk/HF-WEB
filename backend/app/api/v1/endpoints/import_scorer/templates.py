"""CRUD de ImportRubroTemplate."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.rubro_template import ImportRubroTemplate
from app.schemas.import_scorer.templates import (
    ImportRubroTemplateCreate,
    ImportRubroTemplateUpdate,
    ImportRubroTemplateResponse,
)

router = APIRouter()


@router.get("", response_model=List[ImportRubroTemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    return db.query(ImportRubroTemplate).order_by(ImportRubroTemplate.nombre).all()


@router.post("", response_model=ImportRubroTemplateResponse, status_code=201)
def create_template(
    data: ImportRubroTemplateCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    existing = db.query(ImportRubroTemplate).filter(ImportRubroTemplate.nombre == data.nombre).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya existe un template con ese nombre")

    template = ImportRubroTemplate(**data.model_dump())
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/{template_id}", response_model=ImportRubroTemplateResponse)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    template = db.query(ImportRubroTemplate).filter(ImportRubroTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template no encontrado")
    return template


@router.put("/{template_id}", response_model=ImportRubroTemplateResponse)
def update_template(
    template_id: str,
    data: ImportRubroTemplateUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    template = db.query(ImportRubroTemplate).filter(ImportRubroTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template no encontrado")

    if data.nombre and data.nombre != template.nombre:
        existing = db.query(ImportRubroTemplate).filter(ImportRubroTemplate.nombre == data.nombre).first()
        if existing:
            raise HTTPException(status_code=409, detail="Ya existe un template con ese nombre")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)
    return template


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    template = db.query(ImportRubroTemplate).filter(ImportRubroTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template no encontrado")
    db.delete(template)
    db.commit()
