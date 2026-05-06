"""ImportScrapeLog model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime
from app.models.base import Base


class ImportScrapeLog(Base):
    __tablename__ = "import_scrape_logs"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
    fuente = Column(String(200), nullable=False)
    productos_act = Column(Integer, nullable=False, default=0)
    productos_nuevos = Column(Integer, nullable=False, default=0)
    errores = Column(Integer, nullable=False, default=0)
    duracion_ms = Column(Integer, nullable=True)
    detalles = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ImportScrapeLog(fuente={self.fuente}, fecha={self.fecha})>"
