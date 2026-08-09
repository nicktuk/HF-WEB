"""Rangos de código postal que se consideran zona AMBA para el costo de envío."""
from sqlalchemy import Column, Integer
from app.models.base import Base


class CodigoAmba(Base):
    __tablename__ = "codigos_amba"

    id = Column(Integer, primary_key=True, index=True)
    codigo_desde = Column(Integer, nullable=False)
    codigo_hasta = Column(Integer, nullable=False)
