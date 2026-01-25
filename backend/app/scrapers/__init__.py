"""Web scrapers module."""
from app.scrapers.base import BaseScraper, ScrapedProduct
from app.scrapers.registry import ScraperRegistry

__all__ = [
    "BaseScraper",
    "ScrapedProduct",
    "ScraperRegistry",
]
