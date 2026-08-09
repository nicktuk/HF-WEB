"""Schemas for AMBA postal code ranges."""
from pydantic import BaseModel, Field, model_validator


class CodigoAmbaCreate(BaseModel):
    codigo_desde: int = Field(..., ge=1000, le=9999)
    codigo_hasta: int = Field(..., ge=1000, le=9999)

    @model_validator(mode="after")
    def _check_range(self):
        if self.codigo_hasta < self.codigo_desde:
            raise ValueError("El código 'hasta' no puede ser menor que 'desde'")
        return self


class CodigoAmbaResponse(BaseModel):
    id: int
    codigo_desde: int
    codigo_hasta: int

    class Config:
        from_attributes = True
