"""
Product models - Productos del catÃ¡logo del revendedor.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, Text, Numeric,
    DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.models.base import Base


class Product(Base):
    """
    Producto del catÃ¡logo.

    - Se crea a partir de un slug de la web origen
    - El admin puede modificar precio (markup) y habilitar/deshabilitar
    - Solo los productos habilitados se muestran en el catÃ¡logo pÃºblico
    """
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)

    # RelaciÃ³n con web origen
    source_website_id = Column(Integer, ForeignKey("source_websites.id"), nullable=False)
    source_website = relationship("SourceWebsite", back_populates="products")

    # Identificador Ãºnico del producto en la web origen
    slug = Column(String(255), nullable=False, index=True)
    source_url = Column(String(1000), nullable=True)

    # Datos scrapeados de la web original
    original_name = Column(String(500), nullable=False)
    original_price = Column(Numeric(10, 2), nullable=True, comment="Precio origen (puede ser NULL si no estÃ¡ disponible)")
    pending_original_price = Column(Numeric(10, 2), nullable=True, comment="Precio origen pendiente de aprobación")
    pending_price_detected_at = Column(DateTime, nullable=True, comment="Fecha de detección de cambio de precio")
    original_currency = Column(String(3), default="ARS")
    description = Column(Text, nullable=True)
    short_description = Column(String(1000), nullable=True)
    brand = Column(String(100), nullable=True)
    sku = Column(String(100), nullable=True)
    min_purchase_qty = Column(Integer, nullable=True, comment="Cantidad minima de compra")
    kit_content = Column(Text, nullable=True, comment="Contenido del kit/combo")

    # ConfiguraciÃ³n del revendedor
    enabled = Column(Boolean, default=False, nullable=False, index=True)
    is_featured = Column(Boolean, default=False, nullable=False, index=True, comment="Marcado como novedad")
    is_immediate_delivery = Column(Boolean, default=False, nullable=False, index=True, comment="Entrega inmediata")
    is_check_stock = Column(Boolean, default=False, nullable=False, index=True, comment="Consultar stock (excluye nuevo e inmediata)")
    is_best_seller = Column(Boolean, default=False, nullable=False, index=True, comment="Lo mÃ¡s vendido")
    markup_percentage = Column(Numeric(5, 2), default=0, nullable=False, comment="Markup en porcentaje (ej: 25 para 25%)")
    wholesale_markup_percentage = Column(Numeric(5, 2), default=0, nullable=False, comment="Markup mayorista en porcentaje")
    custom_name = Column(String(500), nullable=True, comment="Nombre personalizado (sobrescribe original)")
    custom_price = Column(Numeric(10, 2), nullable=True, comment="Precio fijo personalizado (ignora markup si estÃ¡ definido)")
    display_order = Column(Integer, default=0, nullable=False, comment="Orden de visualizaciÃ³n en catÃ¡logo")

    # Categorias
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True, comment="Categoria maestra local")
    category_ref = relationship("Category", foreign_keys=[category_id])
    source_category = Column(String(100), nullable=True, index=True, comment="Categoria original del mayorista")

    # Subcategoria local (texto, asociada a category_id)
    category = Column(String(100), nullable=True, index=True)
    subcategory = Column(String(100), nullable=True, index=True)

    # Metadatos de scraping
    last_scraped_at = Column(DateTime, nullable=True)
    scrape_error_count = Column(Integer, default=0)
    scrape_last_error = Column(Text, nullable=True)

    # Relaciones
    images = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")
    market_prices = relationship("MarketPrice", back_populates="product", cascade="all, delete-orphan")
    market_price_stats = relationship("MarketPriceStats", back_populates="product", uselist=False, cascade="all, delete-orphan")

    # Ãndice compuesto para queries frecuentes
    __table_args__ = (
        Index("ix_products_source_slug", "source_website_id", "slug", unique=True),
        Index("ix_products_enabled_order", "enabled", "display_order"),
    )

    def __repr__(self):
        return f"<Product(slug={self.slug}, enabled={self.enabled})>"

    @property
    def final_price(self) -> int | None:
        """Calcula el precio final con markup o precio custom, redondeado hacia arriba."""
        import math
        if self.custom_price is not None:
            return math.ceil(float(self.custom_price))
        if self.original_price is not None:
            price = float(self.original_price) * (1 + float(self.markup_percentage) / 100)
            return math.ceil(price)
        return None

    @property
    def display_name(self) -> str:
        """Nombre a mostrar (custom o original)."""
        return self.custom_name or self.original_name


class ProductImage(Base):
    """ImÃ¡genes de un producto."""
    __tablename__ = "product_images"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)

    url = Column(Text, nullable=False)
    original_url = Column(Text, nullable=True, comment="URL original en la web fuente")
    alt_text = Column(String(500), nullable=True)
    display_order = Column(Integer, default=0)
    is_primary = Column(Boolean, default=False)

    # RelaciÃ³n
    product = relationship("Product", back_populates="images")

    __table_args__ = (
        Index("ix_product_images_product", "product_id", "display_order"),
    )

    def __repr__(self):
        return f"<ProductImage(product_id={self.product_id}, is_primary={self.is_primary})>"
