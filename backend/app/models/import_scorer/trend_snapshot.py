"""Modelo para snapshots de tendencias de Google Trends por rubro."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.models.base import Base


class ImportTrendSnapshot(Base):
    __tablename__ = "import_trend_snapshots"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    rubro_id = Column(String, ForeignKey("import_scorer.import_rubros.id", ondelete="CASCADE"), nullable=False, unique=True)
    keyword = Column(String, nullable=False)

    data_ar = Column(JSON, default=list)
    data_usa = Column(JSON, default=list)

    score_ar = Column(Float, default=0.0)
    score_usa = Column(Float, default=0.0)
    tendencia_ar = Column(String, default="sin_datos")
    tendencia_usa = Column(String, default="sin_datos")
