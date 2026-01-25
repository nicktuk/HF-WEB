"""
SourceWebsite model - Representa las webs base de donde se obtienen productos.
Permite configurar múltiples fuentes (hoy newredmayorista, mañana otras).
"""
from sqlalchemy import Column, Integer, String, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from app.models.base import Base


class SourceWebsite(Base):
    """
    Web base de productos (catálogo mayorista).

    Cada web tiene su propia configuración de scraping:
    - Base URL
    - Selectores CSS para extraer datos
    - Requiere autenticación o no
    - Rate limiting específico
    """
    __tablename__ = "source_websites"

    id = Column(Integer, primary_key=True, index=True)

    # Identificación
    name = Column(String(100), unique=True, nullable=False, index=True)
    display_name = Column(String(200), nullable=False)
    base_url = Column(String(500), nullable=False)

    # Estado
    is_active = Column(Boolean, default=True, nullable=False)

    # Configuración de scraping
    scraper_config = Column(JSON, nullable=True, comment="""
        Configuración específica del scraper:
        {
            "product_url_pattern": "/producto/{slug}/",
            "selectors": {
                "name": ".product_title",
                "price": ".price .amount",
                "description": ".woocommerce-product-details__short-description",
                "images": ".woocommerce-product-gallery img",
                "categories": ".breadcrumb a"
            },
            "requires_auth": false,
            "rate_limit_per_minute": 30
        }
    """)

    # Notas/Observaciones
    notes = Column(Text, nullable=True)

    # Relaciones
    products = relationship("Product", back_populates="source_website")

    def __repr__(self):
        return f"<SourceWebsite(name={self.name}, base_url={self.base_url})>"

    def get_product_url(self, slug: str) -> str:
        """Construye la URL completa de un producto."""
        pattern = self.scraper_config.get("product_url_pattern", "/producto/{slug}/")
        path = pattern.format(slug=slug)
        return f"{self.base_url.rstrip('/')}{path}"
