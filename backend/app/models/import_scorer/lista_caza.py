"""ImportListaCaza model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Text, DateTime
from sqlalchemy.dialects.postgresql import ARRAY, JSON
from app.models.base import Base


class ImportListaCaza(Base):
    __tablename__ = "import_listas_caza"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
    carrito_origen_id = Column(String(36), nullable=True)
    estado = Column(String(30), nullable=False, default="pendiente")
    productos = Column(JSON, nullable=False, default=list)
    total_estimado_usd = Column(Float, nullable=False, default=0.0)
    outlets_recomendados_ids = Column(ARRAY(String), nullable=False, default=list)
    fee_agencia_usd = Column(Float, nullable=True)
    notas_agencia = Column(Text, nullable=True)
    resultados_agencia = Column(JSON, nullable=True)

    def __repr__(self):
        return f"<ImportListaCaza(id={self.id}, estado={self.estado})>"
