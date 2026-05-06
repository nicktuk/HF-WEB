"""ImportProducto, ImportOfertaRetailer, ImportHistorico models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class ImportProducto(Base):
    __tablename__ = "import_productos"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre = Column(String(500), nullable=False)
    marca = Column(String(100), nullable=True)
    modelo = Column(String(200), nullable=True)
    rubro_id = Column(String(36), ForeignKey("import_scorer.import_rubros.id"), nullable=False)
    rubro = relationship("ImportRubro", back_populates="productos")
    imagen_url = Column(String(1000), nullable=True)

    # Datos Mercado Libre
    ml_url = Column(String(1000), nullable=True)
    ml_precio_ars = Column(Float, nullable=True)
    ml_vendidos = Column(Integer, nullable=True)
    ml_posicion_ranking = Column(Integer, nullable=True)
    ml_total_competidores = Column(Integer, nullable=True)

    # Mejor oferta USA
    mejor_retailer_id = Column(String(36), ForeignKey("import_scorer.import_retailers.id"), nullable=True)
    mejor_retailer = relationship("ImportRetailer", back_populates="productos_como_mejor")
    mejor_precio_usd = Column(Float, nullable=True)
    mejor_precio_url = Column(String(1000), nullable=True)
    ofertas_usa = relationship("ImportOfertaRetailer", back_populates="producto", cascade="all, delete-orphan")

    # Logística
    peso_kg = Column(Float, nullable=True)
    peso_source = Column(String(50), nullable=True)

    # Costos calculados
    sales_tax_usd = Column(Float, nullable=True)
    costo_flete_usd = Column(Float, nullable=True)
    costo_puesto_usd = Column(Float, nullable=True)
    precio_venta_usd = Column(Float, nullable=True)
    ratio_margen = Column(Float, nullable=True)

    # Modo caza (outlet físico)
    modo_caza = Column(Boolean, nullable=False, default=False)
    precio_objetivo_usd = Column(Float, nullable=True)
    cantidad_sugerida = Column(Integer, nullable=True)

    # Scoring
    score_online = Column(Float, nullable=True)
    score_caza = Column(Float, nullable=True)
    semaforo = Column(String(10), nullable=True)  # "verde" | "amarillo" | "rojo"

    # Gestión manual
    flag_restriccion = Column(String(100), nullable=True)
    notas_manual = Column(Text, nullable=True)
    pinned = Column(Boolean, nullable=False, default=False)
    descartado = Column(Boolean, nullable=False, default=False)

    # Tracking histórico
    veces_importado = Column(Integer, nullable=False, default=0)
    total_unidades_importadas = Column(Integer, nullable=False, default=0)
    total_unidades_vendidas = Column(Integer, nullable=False, default=0)
    dias_promedio_venta = Column(Float, nullable=True)
    margen_real_promedio = Column(Float, nullable=True)

    historico = relationship("ImportHistorico", back_populates="producto", cascade="all, delete-orphan")
    items_carrito = relationship("ImportCarritoItem", back_populates="producto")

    def __repr__(self):
        return f"<ImportProducto(nombre={self.nombre}, semaforo={self.semaforo})>"


class ImportOfertaRetailer(Base):
    __tablename__ = "import_ofertas_retailer"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    producto_id = Column(String(36), ForeignKey("import_scorer.import_productos.id"), nullable=False)
    producto = relationship("ImportProducto", back_populates="ofertas_usa")
    retailer_id = Column(String(36), ForeignKey("import_scorer.import_retailers.id"), nullable=False)
    retailer = relationship("ImportRetailer", back_populates="ofertas")
    precio_usd = Column(Float, nullable=False)
    url = Column(String(1000), nullable=False)
    en_clearance = Column(Boolean, nullable=False, default=False)
    en_stock = Column(Boolean, nullable=False, default=True)
    envio_gratis = Column(Boolean, nullable=False, default=False)
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)

    def __repr__(self):
        return f"<ImportOfertaRetailer(producto_id={self.producto_id}, precio_usd={self.precio_usd})>"


class ImportHistorico(Base):
    __tablename__ = "import_historico"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    producto_id = Column(String(36), ForeignKey("import_scorer.import_productos.id"), nullable=False)
    producto = relationship("ImportProducto", back_populates="historico")
    fecha = Column(DateTime, nullable=False, default=datetime.utcnow)
    ml_precio_ars = Column(Float, nullable=True)
    ml_vendidos = Column(Integer, nullable=True)
    mejor_precio_usd = Column(Float, nullable=True)
    mejor_retailer_nombre = Column(String(200), nullable=True)
    cotizacion_mep = Column(Float, nullable=True)

    def __repr__(self):
        return f"<ImportHistorico(producto_id={self.producto_id}, fecha={self.fecha})>"
