"""Schemas para la configuración del canal comercios de un producto —
separada de ProductUpdate/ProductResponse a propósito, ver app.models.product_comercio.
"""
from typing import Optional, List
from decimal import Decimal
from pydantic import BaseModel, Field


class ProductComercioImageResponse(BaseModel):
    id: int
    url: str
    alt_text: Optional[str] = None

    class Config:
        from_attributes = True


class ComercioIconItem(BaseModel):
    icon: str = Field(..., max_length=40)
    label: str = Field(..., max_length=200)


class ProductComercioConfigUpdate(BaseModel):
    es_mayorista: Optional[bool] = None
    precio_mayorista_override: Optional[Decimal] = Field(None, ge=0)
    unidades_por_bulto: Optional[int] = Field(None, ge=1)
    cantidad_minima: Optional[int] = Field(None, ge=1)
    descripcion: Optional[str] = Field(None, max_length=5000)
    iconos: Optional[List[ComercioIconItem]] = Field(None, max_length=15)
    image_urls: Optional[List[str]] = Field(None, max_length=10)
    image_alt_texts: Optional[List[Optional[str]]] = Field(None, max_length=10)


class ProductComercioConfigResponse(BaseModel):
    product_id: int
    es_mayorista: bool = False
    precio_mayorista_override: Optional[Decimal] = None
    unidades_por_bulto: Optional[int] = None
    cantidad_minima: Optional[int] = None
    descripcion: Optional[str] = None
    iconos: Optional[List[ComercioIconItem]] = None
    images: List[ProductComercioImageResponse] = []

    class Config:
        from_attributes = True


class GenerateComercioIconsRequest(BaseModel):
    descripcion: str = Field(..., min_length=3, max_length=5000)


class GenerateComercioIconsResponse(BaseModel):
    icons: List[ComercioIconItem]
