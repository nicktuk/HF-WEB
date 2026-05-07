"""Schemas para ImportProducto."""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class ImportProductoUpdate(BaseModel):
    peso_kg: Optional[float] = None
    precio_objetivo_usd: Optional[float] = None
    cantidad_sugerida: Optional[int] = None
    modo_caza: Optional[bool] = None
    pinned: Optional[bool] = None
    descartado: Optional[bool] = None
    notas_manual: Optional[str] = None


class ImportOfertaResponse(BaseModel):
    id: str
    retailer_id: str
    retailer_nombre: Optional[str] = None
    precio_usd: float
    url: str
    en_clearance: bool
    en_stock: bool
    envio_gratis: bool
    fecha: datetime

    class Config:
        from_attributes = True


class ImportProductoResponse(BaseModel):
    id: str
    nombre: str
    marca: Optional[str]
    modelo: Optional[str]
    rubro_id: str
    rubro_nombre: Optional[str] = None
    imagen_url: Optional[str]
    ml_url: Optional[str]
    ml_precio_ars: Optional[float]
    ml_vendidos: Optional[int]
    ml_posicion_ranking: Optional[int]
    mejor_retailer_id: Optional[str]
    mejor_retailer_nombre: Optional[str] = None
    mejor_precio_usd: Optional[float]
    mejor_precio_url: Optional[str]
    peso_kg: Optional[float]
    sales_tax_usd: Optional[float]
    costo_flete_usd: Optional[float]
    costo_puesto_usd: Optional[float]
    precio_venta_usd: Optional[float]
    ratio_margen: Optional[float]
    semaforo: Optional[str]
    modo_caza: bool
    precio_objetivo_usd: Optional[float]
    cantidad_sugerida: Optional[int]
    score_online: Optional[float]
    score_caza: Optional[float]
    flag_restriccion: Optional[str]
    pinned: bool
    descartado: bool
    veces_importado: int
    total_unidades_importadas: int
    total_unidades_vendidas: int
    dias_promedio_venta: Optional[float]
    margen_real_promedio: Optional[float]
    notas_manual: Optional[str]
    ofertas: List[ImportOfertaResponse] = []
    updated_at: datetime

    class Config:
        from_attributes = True
