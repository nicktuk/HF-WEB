"""Schemas para ImportRubroTemplate."""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field


class ImportRubroTemplateCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    descripcion: Optional[str] = None
    retailers_recomendados: List[str] = []
    outlets_recomendados: List[str] = []
    margen_minimo_verde: float = Field(2.5, gt=0)
    margen_minimo_amarillo: float = Field(1.8, gt=0)
    top_n_scraping_default: int = Field(50, gt=0)
    dias_rotacion_esperada: Optional[int] = None
    flag_restriccion: Optional[str] = None
    palabras_clave_default: List[str] = []
    blacklist_default: List[str] = []


class ImportRubroTemplateUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    descripcion: Optional[str] = None
    retailers_recomendados: Optional[List[str]] = None
    outlets_recomendados: Optional[List[str]] = None
    margen_minimo_verde: Optional[float] = Field(None, gt=0)
    margen_minimo_amarillo: Optional[float] = Field(None, gt=0)
    top_n_scraping_default: Optional[int] = Field(None, gt=0)
    dias_rotacion_esperada: Optional[int] = None
    flag_restriccion: Optional[str] = None
    palabras_clave_default: Optional[List[str]] = None
    blacklist_default: Optional[List[str]] = None


class ImportRubroTemplateResponse(BaseModel):
    id: str
    nombre: str
    descripcion: Optional[str]
    retailers_recomendados: List[str]
    outlets_recomendados: List[str]
    margen_minimo_verde: float
    margen_minimo_amarillo: float
    top_n_scraping_default: int
    dias_rotacion_esperada: Optional[int]
    flag_restriccion: Optional[str]
    palabras_clave_default: List[str]
    blacklist_default: List[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
