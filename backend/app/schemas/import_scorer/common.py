"""Schemas comunes para Import Scorer."""
from typing import Optional
from pydantic import BaseModel


class MepRateResponse(BaseModel):
    cotizacion: float
    fuente: str
    timestamp: str


class ImportConfigResponse(BaseModel):
    id: str
    costo_flete_usd_por_kg: float
    sales_tax_fl: float
    margen_minimo_verde_global: float
    margen_minimo_amarillo_global: float
    fee_agencia_compra_fisica: float
    umbral_lista_caza_usd: float
    peso_minimo_envio: float
    peso_optimo_envio: float
    peso_maximo_envio: float
    capital_maximo_envio: float

    class Config:
        from_attributes = True


class ImportConfigUpdate(BaseModel):
    costo_flete_usd_por_kg: Optional[float] = None
    sales_tax_fl: Optional[float] = None
    margen_minimo_verde_global: Optional[float] = None
    margen_minimo_amarillo_global: Optional[float] = None
    fee_agencia_compra_fisica: Optional[float] = None
    umbral_lista_caza_usd: Optional[float] = None
    peso_minimo_envio: Optional[float] = None
    peso_optimo_envio: Optional[float] = None
    peso_maximo_envio: Optional[float] = None
    capital_maximo_envio: Optional[float] = None
