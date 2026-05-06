"""ImportOutlet model."""
import uuid
from sqlalchemy import Column, String, Float, Integer, Boolean, Text
from sqlalchemy.dialects.postgresql import ARRAY
from app.models.base import Base


class ImportOutlet(Base):
    __tablename__ = "import_outlets"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre = Column(String(200), nullable=False, unique=True)
    tipo = Column(String(20), nullable=False, default="tienda")  # "tienda" | "mall_outlet"
    ciudad = Column(String(100), nullable=False)
    estado = Column(String(100), nullable=False)
    direccion = Column(String(500), nullable=True)
    rubros_tipicos = Column(ARRAY(String), nullable=False, default=list)
    activo = Column(Boolean, nullable=False, default=True)
    fee_agencia_usd = Column(Float, nullable=False, default=50.0)
    visitas_pasadas = Column(Integer, nullable=False, default=0)
    efectividad_historica = Column(Float, nullable=True)
    notas_internas = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ImportOutlet(nombre={self.nombre}, ciudad={self.ciudad})>"
