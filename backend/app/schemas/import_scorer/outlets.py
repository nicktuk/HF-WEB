"""Schemas para ImportOutlet."""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class ImportOutletCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    tipo: str = Field("tienda", pattern=r'^(tienda|mall_outlet)$')
    ciudad: str = Field(..., min_length=1, max_length=100)
    estado: str = Field(..., min_length=1, max_length=100)
    direccion: Optional[str] = None
    rubros_tipicos: List[str] = []
    activo: bool = True
    fee_agencia_usd: float = Field(50.0, ge=0)
    notas_internas: Optional[str] = None


class ImportOutletUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    tipo: Optional[str] = Field(None, pattern=r'^(tienda|mall_outlet)$')
    ciudad: Optional[str] = Field(None, min_length=1, max_length=100)
    estado: Optional[str] = Field(None, min_length=1, max_length=100)
    direccion: Optional[str] = None
    rubros_tipicos: Optional[List[str]] = None
    activo: Optional[bool] = None
    fee_agencia_usd: Optional[float] = Field(None, ge=0)
    notas_internas: Optional[str] = None


class ImportOutletResponse(BaseModel):
    id: str
    nombre: str
    tipo: str
    ciudad: str
    estado: str
    direccion: Optional[str]
    rubros_tipicos: List[str]
    activo: bool
    fee_agencia_usd: float
    visitas_pasadas: int
    efectividad_historica: Optional[float]
    notas_internas: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
