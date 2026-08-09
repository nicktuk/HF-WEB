"""Admin CRUD for AMBA postal code ranges (used to auto-classify shipping zone)."""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import verify_admin
from app.models.codigo_amba import CodigoAmba
from app.schemas.codigo_amba import CodigoAmbaCreate, CodigoAmbaResponse

router = APIRouter()


@router.get("/codigos-amba", response_model=List[CodigoAmbaResponse], dependencies=[Depends(verify_admin)])
async def list_codigos_amba(db: Session = Depends(get_db)):
    return db.query(CodigoAmba).order_by(CodigoAmba.codigo_desde).all()


@router.post("/codigos-amba", response_model=CodigoAmbaResponse, dependencies=[Depends(verify_admin)])
async def create_codigo_amba(data: CodigoAmbaCreate, db: Session = Depends(get_db)):
    codigo = CodigoAmba(codigo_desde=data.codigo_desde, codigo_hasta=data.codigo_hasta)
    db.add(codigo)
    db.commit()
    db.refresh(codigo)
    return codigo


@router.delete("/codigos-amba/{codigo_id}", dependencies=[Depends(verify_admin)])
async def delete_codigo_amba(codigo_id: int, db: Session = Depends(get_db)):
    codigo = db.query(CodigoAmba).filter(CodigoAmba.id == codigo_id).first()
    if not codigo:
        raise HTTPException(status_code=404, detail="Código no encontrado")
    db.delete(codigo)
    db.commit()
    return {"ok": True}
