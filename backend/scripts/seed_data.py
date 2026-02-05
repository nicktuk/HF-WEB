"""
Seed script to populate initial data.

Run with: python -m scripts.seed_data
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.source_website import SourceWebsite
from app.models.market_price import PriceSource


def seed_source_websites(db):
    """Seed initial source websites."""
    websites = [
        {
            "name": "manual",
            "display_name": "Producto Manual",
            "base_url": "",
            "is_active": True,
            "scraper_config": {},
            "notes": "Productos creados manualmente sin scraping."
        },
        {
            "name": "newredmayorista",
            "display_name": "New Red Mayorista",
            "base_url": "https://newredmayorista.com.ar",
            "is_active": True,
            "scraper_config": {
                "product_url_pattern": "/producto/{slug}/",
                "selectors": {
                    "name": "h1.product_title, .product-title h1",
                    "price": ".price .woocommerce-Price-amount",
                    "description": ".woocommerce-product-details__short-description",
                    "images": ".woocommerce-product-gallery img",
                    "categories": ".breadcrumb a"
                },
                "requires_auth": False,
                "rate_limit_per_minute": 30
            },
            "notes": "Catálogo mayorista. Los precios no están visibles públicamente."
        },
        {
            "name": "redlenic",
            "display_name": "Redlenic",
            "base_url": "https://www.redlenic.uno",
            "is_active": True,
            "scraper_config": {
                "catalog_url": "/catalogo2024.php",
                "requires_auth": True,
                "auth_type": "password_only",
                "selectors": {
                    "product_container": "div.contenedor_producto",
                    "name": "h1",
                    "price": "p.datos",
                    "image": "img"
                }
            },
            "notes": "Catálogo Redlenic. Requiere password para acceder. Todos los productos en una página."
        },
        {
            "name": "decomoda",
            "display_name": "DecoModa Mayorista",
            "base_url": "https://decomoda-mayorista.com.ar",
            "is_active": True,
            "scraper_config": {
                "catalog_url": "/",
                "requires_auth": False,
                "selectors": {
                    "product_link": "a[href*='/store/']",
                    "name": "h1",
                    "price": "schema.org/offers/price",
                    "image": "img[src*='bunny-cdn']"
                }
            },
            "notes": "Catálogo DecoModa Mayorista. Sin autenticación. Precios sin IVA."
        },
        {
            "name": "sina",
            "display_name": "Sina",
            "base_url": "https://www.sina.com.ar",
            "is_active": True,
            "scraper_config": {
                "username": "diezjuarez22@gmail.com",
                "password": "Hermanos1997!",
                "requires_auth": True,
                "auth_type": "login_form"
            },
            "notes": "Catálogo Sina. Usa Browserless.io para el browser."
        },
        {
            "name": "protrade",
            "display_name": "Protrade",
            "base_url": "https://www.protrade.com.ar",
            "is_active": True,
            "scraper_config": {
                "requires_auth": False
            },
            "notes": "Catálogo Protrade. Estructura idéntica a Redlenic."
        }
    ]

    for data in websites:
        existing = db.query(SourceWebsite).filter(SourceWebsite.name == data["name"]).first()
        if not existing:
            website = SourceWebsite(**data)
            db.add(website)
            print(f"Created source website: {data['name']}")
        else:
            # Update existing source with new config
            existing.display_name = data["display_name"]
            existing.base_url = data["base_url"]
            existing.is_active = data["is_active"]
            existing.scraper_config = data["scraper_config"]
            existing.notes = data.get("notes")
            print(f"Updated source website: {data['name']}")

    db.commit()


def seed_price_sources(db):
    """Seed price sources for market intelligence."""
    sources = [
        {
            "name": "mercadolibre",
            "display_name": "MercadoLibre Argentina",
            "base_url": "https://www.mercadolibre.com.ar",
            "is_active": True,
            "rate_limit_per_minute": 30,
            "scraper_config": {
                "search_url": "https://listado.mercadolibre.com.ar/{query}",
                "api_url": "https://api.mercadolibre.com/sites/MLA/search",
            }
        },
        {
            "name": "google_shopping",
            "display_name": "Google Shopping",
            "base_url": "https://shopping.google.com",
            "is_active": False,  # Requires API key
            "rate_limit_per_minute": 10,
            "scraper_config": {
                "requires_api_key": True,
            }
        }
    ]

    for data in sources:
        existing = db.query(PriceSource).filter(PriceSource.name == data["name"]).first()
        if not existing:
            source = PriceSource(**data)
            db.add(source)
            print(f"Created price source: {data['name']}")
        else:
            print(f"Price source already exists: {data['name']}")

    db.commit()


def main():
    """Run all seed functions."""
    print("Seeding database...")

    db = SessionLocal()
    try:
        seed_source_websites(db)
        seed_price_sources(db)
        print("Seeding complete!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
