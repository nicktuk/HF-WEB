"""
Market Price models - Inteligencia de precios del mercado.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, Text, Numeric,
    DateTime, ForeignKey, Index, JSON
)
from sqlalchemy.orm import relationship
from app.models.base import Base


class PriceSource(Base):
    """
    Fuentes de precios de mercado (MercadoLibre, Amazon, Google Shopping, etc.)
    """
    __tablename__ = "price_sources"

    id = Column(Integer, primary_key=True, index=True)

    name = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(200), nullable=False)
    base_url = Column(String(500), nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)

    # Configuración del scraper
    scraper_config = Column(JSON, nullable=True, comment="""
        Configuración específica:
        {
            "search_url_pattern": "/search?q={query}",
            "selectors": {...},
            "rate_limit_per_minute": 30,
            "requires_api_key": false
        }
    """)

    rate_limit_per_minute = Column(Integer, default=30)

    # Relaciones
    market_prices = relationship("MarketPrice", back_populates="source")

    def __repr__(self):
        return f"<PriceSource(name={self.name})>"


class MarketPrice(Base):
    """
    Precio encontrado en el mercado para un producto.

    - Se obtiene buscando el producto en fuentes externas
    - Incluye score de confianza del matching
    - Se marca como inválido si es outlier
    """
    __tablename__ = "market_prices"

    id = Column(Integer, primary_key=True, index=True)

    # Relaciones
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    source_id = Column(Integer, ForeignKey("price_sources.id"), nullable=False)

    product = relationship("Product", back_populates="market_prices")
    source = relationship("PriceSource", back_populates="market_prices")

    # Datos del producto externo
    external_id = Column(String(255), nullable=True, comment="ID del producto en la plataforma externa")
    external_url = Column(Text, nullable=True)
    external_title = Column(String(500), nullable=True)

    # Precio
    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="ARS")
    shipping_cost = Column(Numeric(10, 2), nullable=True)

    # Información del vendedor
    seller_name = Column(String(255), nullable=True)
    seller_reputation = Column(String(50), nullable=True, comment="high, medium, low")

    # Estado
    stock_status = Column(String(50), nullable=True, comment="in_stock, out_of_stock, unknown")

    # Matching
    match_confidence = Column(Numeric(3, 2), nullable=False, comment="0.00 a 1.00")
    match_method = Column(String(50), nullable=True, comment="sku, model, name_similarity")

    # Validación
    is_valid = Column(Boolean, default=True, nullable=False, comment="False si es outlier o sospechoso")

    scraped_at = Column(DateTime, nullable=False)

    __table_args__ = (
        Index("ix_market_prices_product_source", "product_id", "source_id"),
        Index("ix_market_prices_valid_recent", "product_id", "is_valid", "scraped_at"),
    )

    def __repr__(self):
        return f"<MarketPrice(product_id={self.product_id}, price={self.price}, confidence={self.match_confidence})>"


class MarketPriceStats(Base):
    """
    Estadísticas agregadas de precios de mercado por producto.

    - Se recalcula después de cada actualización de market_prices
    - Materializa los cálculos para evitar queries pesadas
    """
    __tablename__ = "market_price_stats"

    id = Column(Integer, primary_key=True, index=True)

    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), unique=True, nullable=False)
    product = relationship("Product", back_populates="market_price_stats")

    # Estadísticas
    avg_price = Column(Numeric(10, 2), nullable=True)
    min_price = Column(Numeric(10, 2), nullable=True)
    max_price = Column(Numeric(10, 2), nullable=True)
    median_price = Column(Numeric(10, 2), nullable=True)

    # Metadata
    sample_count = Column(Integer, default=0)
    outlier_count = Column(Integer, default=0, comment="Precios excluidos por ser anormales")
    sources_count = Column(Integer, default=0, comment="Número de fuentes con datos")

    # Desglose por fuente (JSON para flexibilidad)
    breakdown_by_source = Column(JSON, nullable=True, comment="""
        {
            "mercadolibre": {"avg": 520, "min": 485, "max": 599, "count": 8},
            "google_shopping": {"avg": 510, "min": 480, "max": 550, "count": 4}
        }
    """)

    def __repr__(self):
        return f"<MarketPriceStats(product_id={self.product_id}, avg={self.avg_price})>"
