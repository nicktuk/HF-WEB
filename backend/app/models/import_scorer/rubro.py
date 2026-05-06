"""ImportRubro model."""
import uuid
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import ARRAY, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base


class ImportRubro(Base):
    __tablename__ = "import_rubros"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre = Column(String(200), nullable=False, unique=True)
    template_id = Column(String(36), ForeignKey("import_scorer.import_rubro_templates.id"), nullable=True)
    template = relationship("ImportRubroTemplate", back_populates="rubros")

    # Configuración Mercado Libre
    ml_category_id = Column(String(100), nullable=True)
    ml_listado_url = Column(String(1000), nullable=True)
    top_n_scraping = Column(Integer, nullable=False, default=50)
    filtro_vendidos_min = Column(Integer, nullable=True)

    # Búsqueda USA
    retailers_activos = Column(ARRAY(String), nullable=False, default=list)
    palabras_busqueda_usa = Column(ARRAY(String), nullable=False, default=list)
    palabras_busqueda_traducciones = Column(JSON, nullable=True)

    # Filtros de calidad
    marcas_whitelist = Column(ARRAY(String), nullable=False, default=list)
    blacklist_palabras = Column(ARRAY(String), nullable=False, default=list)
    peso_min_kg = Column(Float, nullable=True)
    peso_max_kg = Column(Float, nullable=True)

    # Scoring personalizado
    margen_minimo_verde = Column(Float, nullable=False, default=2.5)
    margen_minimo_amarillo = Column(Float, nullable=False, default=1.8)
    dias_rotacion_esperada = Column(Integer, nullable=True)

    # Outlets físicos
    outlets_activos = Column(ARRAY(String), nullable=False, default=list)

    # Estacionalidad
    es_estacional = Column(Boolean, nullable=False, default=False)
    meses_alta_demanda = Column(ARRAY(Integer), nullable=False, default=list)

    # Operacional
    activo = Column(Boolean, nullable=False, default=True)
    prioridad = Column(String(20), nullable=False, default="media")
    frecuencia_scraping = Column(String(20), nullable=False, default="diaria")
    flag_restriccion = Column(String(100), nullable=True)
    notas_internas = Column(Text, nullable=True)

    productos = relationship("ImportProducto", back_populates="rubro")

    def __repr__(self):
        return f"<ImportRubro(nombre={self.nombre}, activo={self.activo})>"
