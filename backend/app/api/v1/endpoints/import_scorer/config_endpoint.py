"""Configuración global de Import Scorer."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.config import ImportConfig
from app.schemas.import_scorer.common import ImportConfigResponse, ImportConfigUpdate

router = APIRouter()


@router.get("", response_model=ImportConfigResponse)
def get_config(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    config = db.query(ImportConfig).first()
    if not config:
        config = ImportConfig()
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.put("", response_model=ImportConfigResponse)
def update_config(
    data: ImportConfigUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    config = db.query(ImportConfig).first()
    if not config:
        config = ImportConfig()
        db.add(config)

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(config, field, value)
    config.ultima_actualizacion = datetime.utcnow()

    db.commit()
    db.refresh(config)
    return config
