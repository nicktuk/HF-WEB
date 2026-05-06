"""ImportRetailer model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime
from sqlalchemy.orm import relationship
from app.models.base import Base


class ImportRetailer(Base):
    __tablename__ = "import_retailers"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre = Column(String(200), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)
    tipo = Column(String(20), nullable=False, default="online")  # "online" | "ambos"
    base_url = Column(String(500), nullable=False)
    search_url_template = Column(String(1000), nullable=False)
    scraper_implementacion = Column(String(100), nullable=False, default="")
    requiere_auth = Column(Boolean, nullable=False, default=False)
    cobra_tax_fl = Column(Boolean, nullable=False, default=True)
    envio_gratis_umbral = Column(Float, nullable=True)
    delay_min_ms = Column(Integer, nullable=False, default=2000)
    delay_max_ms = Column(Integer, nullable=False, default=5000)
    requiere_stealth = Column(Boolean, nullable=False, default=True)
    activo = Column(Boolean, nullable=False, default=True)
    pausado_hasta = Column(DateTime, nullable=True)
    ultimo_error = Column(Text, nullable=True)
    veces_usado = Column(Integer, nullable=False, default=0)
    productos_comprados_total = Column(Integer, nullable=False, default=0)
    margen_real_promedio = Column(Float, nullable=True)

    ofertas = relationship("ImportOfertaRetailer", back_populates="retailer")
    productos_como_mejor = relationship("ImportProducto", back_populates="mejor_retailer")

    def __repr__(self):
        return f"<ImportRetailer(slug={self.slug}, activo={self.activo})>"
