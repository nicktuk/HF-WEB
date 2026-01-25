"""Scraper registry - Factory pattern for managing scrapers."""
from typing import Dict, Type, Optional, List
import logging

from app.scrapers.base import BaseScraper

logger = logging.getLogger(__name__)


class ScraperRegistry:
    """
    Registry for scraper classes.

    Usage:
        # Register a scraper
        ScraperRegistry.register(NewRedMayoristaScraper)

        # Get a scraper instance
        scraper = ScraperRegistry.get_scraper("newredmayorista")

        # Get all registered scrapers
        scrapers = ScraperRegistry.get_all()
    """

    _scrapers: Dict[str, Type[BaseScraper]] = {}
    _instances: Dict[str, BaseScraper] = {}

    @classmethod
    def register(cls, scraper_class: Type[BaseScraper]) -> None:
        """
        Register a scraper class.

        Args:
            scraper_class: Scraper class to register
        """
        # Create a temporary instance to get source_name
        temp_instance = scraper_class.__new__(scraper_class)
        temp_instance._client = None
        temp_instance._owns_client = True

        name = temp_instance.source_name
        cls._scrapers[name] = scraper_class
        logger.info(f"Registered scraper: {name}")

    @classmethod
    def get_scraper(cls, name: str, fresh: bool = False) -> BaseScraper:
        """
        Get a scraper instance by name.

        Args:
            name: Scraper source_name
            fresh: If True, create a new instance instead of using cached

        Returns:
            Scraper instance

        Raises:
            ValueError: If scraper not found
        """
        if name not in cls._scrapers:
            available = ", ".join(cls._scrapers.keys())
            raise ValueError(f"Scraper '{name}' not found. Available: {available}")

        if fresh or name not in cls._instances:
            cls._instances[name] = cls._scrapers[name]()

        return cls._instances[name]

    @classmethod
    def get_all(cls) -> Dict[str, BaseScraper]:
        """Get all registered scraper instances."""
        for name in cls._scrapers:
            if name not in cls._instances:
                cls._instances[name] = cls._scrapers[name]()
        return cls._instances

    @classmethod
    def get_market_scrapers(cls) -> List[BaseScraper]:
        """Get all market intelligence scrapers (excluding catalog scrapers)."""
        market_scraper_names = ["mercadolibre", "google_shopping"]
        return [
            cls.get_scraper(name)
            for name in market_scraper_names
            if name in cls._scrapers
        ]

    @classmethod
    def is_registered(cls, name: str) -> bool:
        """Check if a scraper is registered."""
        return name in cls._scrapers

    @classmethod
    def unregister(cls, name: str) -> None:
        """Unregister a scraper."""
        if name in cls._scrapers:
            del cls._scrapers[name]
        if name in cls._instances:
            del cls._instances[name]

    @classmethod
    async def close_all(cls) -> None:
        """Close all scraper instances."""
        for scraper in cls._instances.values():
            await scraper.close()
        cls._instances.clear()
