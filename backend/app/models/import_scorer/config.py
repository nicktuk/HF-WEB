"""ImportConfig model — singleton de configuración global."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime
from app.models.base import Base


class ImportConfig(Base):
    __tablename__ = "import_config"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    costo_flete_usd_por_kg = Column(Float, nullable=False, default=50.0)
    sales_tax_fl = Column(Float, nullable=False, default=0.07)
    margen_minimo_verde_global = Column(Float, nullable=False, default=2.5)
    margen_minimo_amarillo_global = Column(Float, nullable=False, default=1.8)
    fee_agencia_compra_fisica = Column(Float, nullable=False, default=50.0)
    umbral_lista_caza_usd = Column(Float, nullable=False, default=500.0)
    peso_minimo_envio = Column(Float, nullable=False, default=15.0)
    peso_optimo_envio = Column(Float, nullable=False, default=40.0)
    peso_maximo_envio = Column(Float, nullable=False, default=60.0)
    capital_maximo_envio = Column(Float, nullable=False, default=5000.0)
    ultima_actualizacion = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<ImportConfig(costo_flete={self.costo_flete_usd_por_kg}, tax={self.sales_tax_fl})>"
