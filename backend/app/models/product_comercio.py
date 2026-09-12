"""Configuración del canal comercios por producto — separada de Product a
propósito: todo lo que solo aplica al canal mayorista (visibilidad, precio
manual, reglas de compra, descripción y fotos propias) vive acá, para no
seguir mezclándolo con los campos del catálogo minorista.
"""
from sqlalchemy import Column, Integer, String, Boolean, Text, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class ProductComercioConfig(Base):
    __tablename__ = "product_comercio_config"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, unique=True)

    es_mayorista = Column(Boolean, default=False, nullable=False, index=True, comment="Visible en catálogo comercios")
    precio_mayorista_override = Column(Numeric(12, 2), nullable=True, comment="Precio comercio manual (pisa el cálculo por regla)")
    unidades_por_bulto = Column(Integer, nullable=True, comment="Unidades por bulto en el canal comercios")
    cantidad_minima = Column(Integer, nullable=True, comment="Cantidad mínima de compra en el canal comercios")
    descripcion = Column(Text, nullable=True, comment="Descripción propia del canal comercios (no la del minorista)")

    product = relationship("Product", backref="comercio_config", uselist=False)

    def __repr__(self):
        return f"<ProductComercioConfig(product_id={self.product_id}, es_mayorista={self.es_mayorista})>"


class ProductComercioImage(Base):
    """Fotos propias del canal comercios — no reutiliza las del minorista."""
    __tablename__ = "product_comercio_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)

    url = Column(Text, nullable=False)
    alt_text = Column(String(500), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)

    def __repr__(self):
        return f"<ProductComercioImage(product_id={self.product_id})>"
