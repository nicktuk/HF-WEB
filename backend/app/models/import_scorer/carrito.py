"""ImportCarrito y ImportCarritoItem models."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class ImportCarrito(Base):
    __tablename__ = "import_carritos"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nombre = Column(String(200), nullable=False)
    estado = Column(String(30), nullable=False, default="borrador")
    notas = Column(Text, nullable=True)
    cotizacion_mep_snapshot = Column(Float, nullable=True)
    fecha_cotizacion = Column(DateTime, nullable=True)
    fecha_compra = Column(DateTime, nullable=True)
    fecha_arribo = Column(DateTime, nullable=True)
    costo_total_real_usd = Column(Float, nullable=True)
    costo_flete_real_usd = Column(Float, nullable=True)
    fee_agencia_usd = Column(Float, nullable=True)
    peso_real_kg = Column(Float, nullable=True)
    es_plantilla = Column(Boolean, nullable=False, default=False)

    items = relationship("ImportCarritoItem", back_populates="carrito", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ImportCarrito(nombre={self.nombre}, estado={self.estado})>"


class ImportCarritoItem(Base):
    __tablename__ = "import_carrito_items"
    __table_args__ = {"schema": "import_scorer"}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    carrito_id = Column(String(36), ForeignKey("import_scorer.import_carritos.id", ondelete="CASCADE"), nullable=False)
    carrito = relationship("ImportCarrito", back_populates="items")
    producto_id = Column(String(36), ForeignKey("import_scorer.import_productos.id"), nullable=False)
    producto = relationship("ImportProducto", back_populates="items_carrito")
    retailer_id = Column(String(36), nullable=True)
    precio_usd_locked = Column(Float, nullable=False)
    peso_kg_locked = Column(Float, nullable=False)
    cantidad = Column(Integer, nullable=False, default=1)
    en_clearance_at_add = Column(Boolean, nullable=False, default=False)
    modo_compra = Column(String(20), nullable=False, default="online")
    outlet_esperado_id = Column(String(36), nullable=True)
    comprado = Column(Boolean, nullable=False, default=False)
    fecha_compra = Column(DateTime, nullable=True)
    precio_real_usd = Column(Float, nullable=True)
    unidades_recibidas = Column(Integer, nullable=False, default=0)
    unidades_vendidas = Column(Integer, nullable=False, default=0)
    fecha_primer_venta = Column(DateTime, nullable=True)
    fecha_ultima_venta = Column(DateTime, nullable=True)
    precio_venta_promedio_ars = Column(Float, nullable=True)
    margen_real_ratio = Column(Float, nullable=True)
    notas = Column(Text, nullable=True)

    def __repr__(self):
        return f"<ImportCarritoItem(carrito_id={self.carrito_id}, producto_id={self.producto_id})>"
