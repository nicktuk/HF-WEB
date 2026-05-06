"""Schemas para ImportRubro."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class ImportRubroCreate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=200)
    template_id: Optional[str] = None
    ml_category_id: Optional[str] = None
    ml_listado_url: Optional[str] = None
    top_n_scraping: int = Field(50, gt=0)
    filtro_vendidos_min: Optional[int] = None
    retailers_activos: List[str] = []
    palabras_busqueda_usa: List[str] = []
    palabras_busqueda_traducciones: Optional[Dict[str, Any]] = None
    marcas_whitelist: List[str] = []
    blacklist_palabras: List[str] = []
    peso_min_kg: Optional[float] = None
    peso_max_kg: Optional[float] = None
    margen_minimo_verde: float = Field(2.5, gt=0)
    margen_minimo_amarillo: float = Field(1.8, gt=0)
    dias_rotacion_esperada: Optional[int] = None
    outlets_activos: List[str] = []
    es_estacional: bool = False
    meses_alta_demanda: List[int] = []
    activo: bool = True
    prioridad: str = Field("media", pattern=r'^(alta|media|baja)$')
    frecuencia_scraping: str = Field("diaria", pattern=r'^(diaria|semanal|manual)$')
    flag_restriccion: Optional[str] = None
    notas_internas: Optional[str] = None


class ImportRubroUpdate(BaseModel):
    nombre: Optional[str] = Field(None, min_length=1, max_length=200)
    template_id: Optional[str] = None
    ml_category_id: Optional[str] = None
    ml_listado_url: Optional[str] = None
    top_n_scraping: Optional[int] = Field(None, gt=0)
    filtro_vendidos_min: Optional[int] = None
    retailers_activos: Optional[List[str]] = None
    palabras_busqueda_usa: Optional[List[str]] = None
    palabras_busqueda_traducciones: Optional[Dict[str, Any]] = None
    marcas_whitelist: Optional[List[str]] = None
    blacklist_palabras: Optional[List[str]] = None
    peso_min_kg: Optional[float] = None
    peso_max_kg: Optional[float] = None
    margen_minimo_verde: Optional[float] = Field(None, gt=0)
    margen_minimo_amarillo: Optional[float] = Field(None, gt=0)
    dias_rotacion_esperada: Optional[int] = None
    outlets_activos: Optional[List[str]] = None
    es_estacional: Optional[bool] = None
    meses_alta_demanda: Optional[List[int]] = None
    activo: Optional[bool] = None
    prioridad: Optional[str] = Field(None, pattern=r'^(alta|media|baja)$')
    frecuencia_scraping: Optional[str] = Field(None, pattern=r'^(diaria|semanal|manual)$')
    flag_restriccion: Optional[str] = None
    notas_internas: Optional[str] = None


class ImportRubroResponse(BaseModel):
    id: str
    nombre: str
    template_id: Optional[str]
    ml_category_id: Optional[str]
    ml_listado_url: Optional[str]
    top_n_scraping: int
    filtro_vendidos_min: Optional[int]
    retailers_activos: List[str]
    palabras_busqueda_usa: List[str]
    palabras_busqueda_traducciones: Optional[Dict[str, Any]]
    marcas_whitelist: List[str]
    blacklist_palabras: List[str]
    peso_min_kg: Optional[float]
    peso_max_kg: Optional[float]
    margen_minimo_verde: float
    margen_minimo_amarillo: float
    dias_rotacion_esperada: Optional[int]
    outlets_activos: List[str]
    es_estacional: bool
    meses_alta_demanda: List[int]
    activo: bool
    prioridad: str
    frecuencia_scraping: str
    flag_restriccion: Optional[str]
    notas_internas: Optional[str]
    total_productos: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
