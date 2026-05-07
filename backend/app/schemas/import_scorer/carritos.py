"""Schemas para ImportCarrito y ImportCarritoItem."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ImportCarritoItemCreate(BaseModel):
    producto_id: str
    retailer_id: Optional[str] = None
    precio_usd_locked: float = Field(..., gt=0)
    peso_kg_locked: float = Field(..., gt=0)
    cantidad: int = Field(1, ge=1)
    en_clearance_at_add: bool = False
    modo_compra: str = Field("online", pattern=r'^(online|outlet)$')
    outlet_esperado_id: Optional[str] = None


class ImportCarritoItemUpdate(BaseModel):
    cantidad: Optional[int] = Field(None, ge=1)
    precio_real_usd: Optional[float] = None
    unidades_recibidas: Optional[int] = None
    unidades_vendidas: Optional[int] = None
    fecha_compra: Optional[datetime] = None
    precio_venta_promedio_ars: Optional[float] = None
    margen_real_ratio: Optional[float] = None
    comprado: Optional[bool] = None
    notas: Optional[str] = None


class ImportCarritoItemResponse(BaseModel):
    id: str
    carrito_id: str
    producto_id: str
    producto_nombre: Optional[str] = None
    producto_imagen_url: Optional[str] = None
    retailer_id: Optional[str]
    retailer_nombre: Optional[str] = None
    precio_usd_locked: float
    peso_kg_locked: float
    cantidad: int
    en_clearance_at_add: bool
    modo_compra: str
    outlet_esperado_id: Optional[str]
    comprado: bool
    fecha_compra: Optional[datetime]
    precio_real_usd: Optional[float]
    unidades_recibidas: int
    unidades_vendidas: int
    precio_venta_promedio_ars: Optional[float]
    margen_real_ratio: Optional[float]
    notas: Optional[str]

    class Config:
        from_attributes = True


class ImportCarritoCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    notas: Optional[str] = None
    es_plantilla: bool = False


class ImportCarritoUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    notas: Optional[str] = None
    estado: Optional[str] = Field(
        None,
        pattern=r'^(borrador|cotizado|comprado|en_transito|recibido|cancelado)$'
    )
    cotizacion_mep_snapshot: Optional[float] = None
    fecha_cotizacion: Optional[datetime] = None
    fecha_compra: Optional[datetime] = None
    fecha_arribo: Optional[datetime] = None
    costo_total_real_usd: Optional[float] = None
    costo_flete_real_usd: Optional[float] = None
    fee_agencia_usd: Optional[float] = None
    peso_real_kg: Optional[float] = None


class ImportCarritoResponse(BaseModel):
    id: str
    nombre: str
    estado: str
    notas: Optional[str]
    cotizacion_mep_snapshot: Optional[float]
    fecha_cotizacion: Optional[datetime]
    fecha_compra: Optional[datetime]
    fecha_arribo: Optional[datetime]
    costo_total_real_usd: Optional[float]
    costo_flete_real_usd: Optional[float]
    fee_agencia_usd: Optional[float]
    peso_real_kg: Optional[float]
    es_plantilla: bool
    items: List[ImportCarritoItemResponse] = []
    total_items: int = 0
    resumen: Optional[Dict[str, Any]] = None
    alertas: List[Dict[str, Any]] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
