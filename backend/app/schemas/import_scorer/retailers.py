"""Schemas para ImportRetailer."""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ImportRetailerCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=100, pattern=r'^[a-z0-9\-]+$')
    tipo: str = Field("online", pattern=r'^(online|ambos)$')
    base_url: str = Field(..., min_length=1, max_length=500)
    search_url_template: str = Field(..., min_length=1, max_length=1000)
    scraper_implementacion: str = Field("", max_length=100)
    requiere_auth: bool = False
    cobra_tax_fl: bool = True
    envio_gratis_umbral: Optional[float] = None
    delay_min_ms: int = Field(2000, ge=500)
    delay_max_ms: int = Field(5000, ge=500)
    requiere_stealth: bool = True
    activo: bool = True


class ImportRetailerUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    tipo: Optional[str] = Field(None, pattern=r'^(online|ambos)$')
    base_url: Optional[str] = Field(None, min_length=1, max_length=500)
    search_url_template: Optional[str] = Field(None, min_length=1, max_length=1000)
    scraper_implementacion: Optional[str] = Field(None, max_length=100)
    requiere_auth: Optional[bool] = None
    cobra_tax_fl: Optional[bool] = None
    envio_gratis_umbral: Optional[float] = None
    delay_min_ms: Optional[int] = Field(None, ge=500)
    delay_max_ms: Optional[int] = Field(None, ge=500)
    requiere_stealth: Optional[bool] = None
    activo: Optional[bool] = None
    pausado_hasta: Optional[datetime] = None


class ImportRetailerResponse(BaseModel):
    id: str
    nombre: str
    slug: str
    tipo: str
    base_url: str
    search_url_template: str
    scraper_implementacion: str
    requiere_auth: bool
    cobra_tax_fl: bool
    envio_gratis_umbral: Optional[float]
    delay_min_ms: int
    delay_max_ms: int
    requiere_stealth: bool
    activo: bool
    pausado_hasta: Optional[datetime]
    ultimo_error: Optional[str]
    veces_usado: int
    productos_comprados_total: int
    margen_real_promedio: Optional[float]
    scraper_disponible: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
