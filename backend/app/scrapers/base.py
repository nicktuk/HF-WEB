"""Base scraper class and data structures."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Any
from datetime import datetime
import httpx
from bs4 import BeautifulSoup
import re
import logging

from app.core.exceptions import ScraperError
from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ScrapedProduct:
    """Data structure for scraped product information."""
    slug: str
    name: str
    price: Optional[float] = None
    currency: str = "ARS"
    description: Optional[str] = None
    short_description: Optional[str] = None
    brand: Optional[str] = None
    sku: Optional[str] = None
    images: List[str] = field(default_factory=list)
    categories: List[str] = field(default_factory=list)
    source_url: Optional[str] = None
    scraped_at: datetime = field(default_factory=datetime.utcnow)
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MarketSearchResult:
    """Data structure for market price search results."""
    title: str
    price: float
    currency: str = "ARS"
    url: Optional[str] = None
    seller_name: Optional[str] = None
    seller_reputation: Optional[str] = None
    shipping_cost: Optional[float] = None
    match_confidence: float = 0.0
    match_method: str = "name"
    source_name: str = ""


class BaseScraper(ABC):
    """
    Abstract base class for all scrapers.

    Subclasses must implement:
    - source_name: Unique identifier for this scraper
    - scrape_product: Extract product data from a page
    """

    def __init__(self, http_client: Optional[httpx.AsyncClient] = None):
        self._client = http_client
        self._owns_client = http_client is None

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Unique identifier for this scraper."""
        pass

    @property
    def rate_limit_delay(self) -> float:
        """Delay between requests in seconds."""
        return 1.0

    @property
    def default_headers(self) -> Dict[str, str]:
        """Default headers for requests."""
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
        }

    async def get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=settings.SCRAPER_TIMEOUT,
                follow_redirects=True,
            )
        return self._client

    async def close(self):
        """Close HTTP client if we own it."""
        if self._owns_client and self._client:
            await self._client.aclose()
            self._client = None

    async def fetch_html(self, url: str) -> BeautifulSoup:
        """
        Fetch URL and return parsed HTML.

        Args:
            url: URL to fetch

        Returns:
            BeautifulSoup object

        Raises:
            ScraperError: If request fails
        """
        client = await self.get_client()
        try:
            response = await client.get(url, headers=self.default_headers)
            response.raise_for_status()
            return BeautifulSoup(response.content, "lxml")
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                raise ScraperError(
                    f"Product not found at {url}",
                    source=self.source_name
                )
            raise ScraperError(
                f"HTTP error {e.response.status_code} fetching {url}",
                source=self.source_name
            )
        except httpx.RequestError as e:
            raise ScraperError(
                f"Request failed for {url}: {str(e)}",
                source=self.source_name
            )

    @abstractmethod
    async def scrape_product(self, identifier: str, config: Optional[Dict] = None) -> ScrapedProduct:
        """
        Scrape product information.

        Args:
            identifier: Product identifier (slug, URL, SKU, etc.)
            config: Optional configuration dictionary

        Returns:
            ScrapedProduct with extracted data

        Raises:
            ScraperError: If scraping fails
        """
        pass

    async def scrape_catalog(self, config: Optional[Dict] = None) -> List[str]:
        """
        Scrape all product identifiers from the catalog.

        This is optional - not all scrapers support catalog scraping.
        Override in subclass to enable "scrape all" functionality.

        Args:
            config: Optional configuration dictionary

        Returns:
            List of product identifiers (slugs/SKUs)

        Raises:
            NotImplementedError: If scraper doesn't support catalog scraping
        """
        raise NotImplementedError(
            f"Scraper {self.source_name} doesn't support catalog scraping"
        )

    # Helper methods for data extraction

    def extract_text(self, soup: BeautifulSoup, selector: str) -> Optional[str]:
        """Extract text from first matching element."""
        elem = soup.select_one(selector)
        return elem.text.strip() if elem else None

    def extract_all_text(self, soup: BeautifulSoup, selector: str) -> List[str]:
        """Extract text from all matching elements."""
        elements = soup.select(selector)
        return [elem.text.strip() for elem in elements if elem.text.strip()]

    def extract_attr(self, soup: BeautifulSoup, selector: str, attr: str) -> Optional[str]:
        """Extract attribute from first matching element."""
        elem = soup.select_one(selector)
        return elem.get(attr) if elem else None

    def extract_all_attrs(self, soup: BeautifulSoup, selector: str, attr: str) -> List[str]:
        """Extract attribute from all matching elements."""
        elements = soup.select(selector)
        return [elem.get(attr) for elem in elements if elem.get(attr)]

    def extract_price(self, text: str) -> Optional[float]:
        """
        Extract price from text.

        Handles formats like:
        - $1,234.56
        - $ 1.234,56
        - 1234.56
        - 1234,56
        """
        if not text:
            return None

        # Remove currency symbols and spaces
        text = re.sub(r'[^\d.,]', '', text)

        # Handle different decimal separators
        # If there's a comma after a dot, assume comma is decimal separator
        if ',' in text and '.' in text:
            if text.rindex(',') > text.rindex('.'):
                # 1.234,56 format
                text = text.replace('.', '').replace(',', '.')
            else:
                # 1,234.56 format
                text = text.replace(',', '')
        elif ',' in text:
            # Could be 1,234 (thousands) or 1234,56 (decimal)
            # If comma is in last 3 positions, assume decimal
            if len(text) - text.rindex(',') <= 3:
                text = text.replace(',', '.')
            else:
                text = text.replace(',', '')

        try:
            return float(text)
        except ValueError:
            return None

    def normalize_image_url(self, url: str, base_url: str) -> str:
        """Convert relative URL to absolute."""
        if not url:
            return ""
        if url.startswith("//"):
            return "https:" + url
        if url.startswith("/"):
            return base_url.rstrip("/") + url
        if not url.startswith("http"):
            return base_url.rstrip("/") + "/" + url
        return url
