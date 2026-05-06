"""ImportRubroTemplate model."""
import uuid
from sqlalchemy import Column, String, Float, Integer, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from app.models.base import Base


class ImportRubroTemplate(Base):
    __tablename__ = "import_rubro_templates"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre = Column(String(200), nullable=False, unique=True)
    descripcion = Column(Text, nullable=True)
    retailers_recomendados = Column(ARRAY(String), nullable=False, default=list)
    outlets_recomendados = Column(ARRAY(String), nullable=False, default=list)
    margen_minimo_verde = Column(Float, nullable=False, default=2.5)
    margen_minimo_amarillo = Column(Float, nullable=False, default=1.8)
    top_n_scraping_default = Column(Integer, nullable=False, default=50)
    dias_rotacion_esperada = Column(Integer, nullable=True)
    flag_restriccion = Column(String(100), nullable=True)
    palabras_clave_default = Column(ARRAY(String), nullable=False, default=list)
    blacklist_default = Column(ARRAY(String), nullable=False, default=list)

    rubros = relationship("ImportRubro", back_populates="template")

    def __repr__(self):
        return f"<ImportRubroTemplate(nombre={self.nombre})>"
