"""Schemas para ImportListaCaza."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class ImportListaCazaCreate(BaseModel):
    carrito_origen_id: Optional[str] = None
    productos: List[Dict[str, Any]] = []
    total_estimado_usd: float = 0.0
    outlets_recomendados_ids: List[str] = []
    fee_agencia_usd: Optional[float] = None
    notas_agencia: Optional[str] = None


class ImportListaCazaUpdate(BaseModel):
    estado: Optional[str] = None
    productos: Optional[List[Dict[str, Any]]] = None
    total_estimado_usd: Optional[float] = None
    outlets_recomendados_ids: Optional[List[str]] = None
    fee_agencia_usd: Optional[float] = None
    notas_agencia: Optional[str] = None
    resultados_agencia: Optional[Dict[str, Any]] = None


class ImportListaCazaResponse(BaseModel):
    id: str
    fecha: datetime
    carrito_origen_id: Optional[str]
    estado: str
    productos: List[Dict[str, Any]]
    total_estimado_usd: float
    outlets_recomendados_ids: List[str]
    fee_agencia_usd: Optional[float]
    notas_agencia: Optional[str]
    resultados_agencia: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True
