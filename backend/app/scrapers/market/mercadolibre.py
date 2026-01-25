"""
MercadoLibre scraper for market price intelligence.

Uses the public search to find similar products and extract prices.
"""
from typing import Optional, Dict, List
import re
from urllib.parse import quote_plus
from difflib import SequenceMatcher

from app.scrapers.base import BaseScraper, ScrapedProduct, MarketSearchResult
from app.core.exceptions import ScraperError


class MercadoLibreScraper(BaseScraper):
    """Scraper for MercadoLibre Argentina market prices."""

    BASE_URL = "https://listado.mercadolibre.com.ar"
    API_URL = "https://api.mercadolibre.com"

    @property
    def source_name(self) -> str:
        return "mercadolibre"

    @property
    def rate_limit_delay(self) -> float:
        return 2.0  # MercadoLibre is strict about rate limiting

    async def scrape_product(
        self,
        identifier: str,
        config: Optional[Dict] = None
    ) -> ScrapedProduct:
        """Not used for market intelligence - use search_products instead."""
        raise NotImplementedError("Use search_products for MercadoLibre")

    async def search_products(
        self,
        query: str,
        limit: int = 10,
        min_confidence: float = 0.5
    ) -> List[MarketSearchResult]:
        """
        Search MercadoLibre for products matching the query.

        Args:
            query: Search query (product name)
            limit: Maximum number of results
            min_confidence: Minimum match confidence (0-1)

        Returns:
            List of MarketSearchResult with prices and confidence scores
        """
        # Clean and prepare query
        query = self._clean_query(query)

        # Use public API for search
        results = await self._search_api(query, limit * 2)  # Get extra for filtering

        # Calculate match confidence and filter
        filtered_results = []
        for result in results:
            confidence = self._calculate_confidence(query, result)
            if confidence >= min_confidence:
                result.match_confidence = confidence
                filtered_results.append(result)

        # Sort by confidence and limit
        filtered_results.sort(key=lambda x: x.match_confidence, reverse=True)
        return filtered_results[:limit]

    async def _search_api(self, query: str, limit: int) -> List[MarketSearchResult]:
        """Search using MercadoLibre public API."""
        client = await self.get_client()

        url = f"{self.API_URL}/sites/MLA/search"
        params = {
            "q": query,
            "limit": min(limit, 50),
            "condition": "new",  # Solo productos nuevos
        }

        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()

            results = []
            for item in data.get("results", []):
                result = self._parse_api_result(item)
                if result:
                    results.append(result)

            return results

        except Exception as e:
            # Fallback to HTML scraping if API fails
            return await self._search_html(query, limit)

    async def _search_html(self, query: str, limit: int) -> List[MarketSearchResult]:
        """Fallback: Search by scraping HTML."""
        encoded_query = quote_plus(query)
        url = f"{self.BASE_URL}/{encoded_query}_NoIndex_True"

        soup = await self.fetch_html(url)
        results = []

        # Find product items
        items = soup.select(".ui-search-layout__item")[:limit]

        for item in items:
            try:
                result = self._parse_html_result(item)
                if result:
                    results.append(result)
            except Exception:
                continue

        return results

    def _parse_api_result(self, item: dict) -> Optional[MarketSearchResult]:
        """Parse a single result from API response."""
        try:
            price = item.get("price")
            if not price or price <= 0:
                return None

            # Get seller info
            seller = item.get("seller", {})
            seller_name = seller.get("nickname")

            # Determine seller reputation
            seller_reputation = "unknown"
            if seller.get("seller_reputation"):
                level = seller["seller_reputation"].get("level_id", "")
                if "platinum" in level.lower():
                    seller_reputation = "high"
                elif "gold" in level.lower():
                    seller_reputation = "medium"
                else:
                    seller_reputation = "low"

            # Get shipping info
            shipping = item.get("shipping", {})
            shipping_cost = None
            if shipping.get("free_shipping"):
                shipping_cost = 0

            return MarketSearchResult(
                title=item.get("title", ""),
                price=float(price),
                currency=item.get("currency_id", "ARS"),
                url=item.get("permalink"),
                seller_name=seller_name,
                seller_reputation=seller_reputation,
                shipping_cost=shipping_cost,
                source_name=self.source_name,
                match_method="api_search",
            )

        except (KeyError, TypeError, ValueError):
            return None

    def _parse_html_result(self, item) -> Optional[MarketSearchResult]:
        """Parse a single result from HTML."""
        try:
            # Title - try multiple selectors
            title_elem = (
                item.select_one(".ui-search-item__title") or
                item.select_one(".poly-component__title") or
                item.select_one("h2") or
                item.select_one("a[title]")
            )
            if title_elem:
                title = title_elem.get("title") or title_elem.text.strip()
            else:
                title = ""

            if not title:
                return None

            # Price - try multiple selectors
            price_elem = (
                item.select_one(".andes-money-amount__fraction") or
                item.select_one(".price-tag-fraction") or
                item.select_one("[class*='price'] [class*='fraction']")
            )
            if not price_elem:
                return None

            price_text = price_elem.text.replace(".", "").replace(",", "")
            price = float(price_text)

            if price <= 0:
                return None

            # URL - try multiple selectors
            link_elem = (
                item.select_one("a.ui-search-link") or
                item.select_one("a.poly-component__title") or
                item.select_one("a[href*='/MLA']")
            )
            url = link_elem.get("href") if link_elem else None

            # Shipping
            shipping_cost = None
            free_shipping = (
                item.select_one(".ui-search-item__shipping--free") or
                item.select_one("[class*='shipping'][class*='free']") or
                item.select_one("[class*='free-shipping']")
            )
            if free_shipping:
                shipping_cost = 0

            return MarketSearchResult(
                title=title,
                price=price,
                currency="ARS",
                url=url,
                shipping_cost=shipping_cost,
                source_name=self.source_name,
                match_method="html_search",
            )

        except (AttributeError, ValueError):
            return None

    def _clean_query(self, query: str) -> str:
        """Clean search query for better results."""
        # Remove common non-descriptive words
        stop_words = [
            'nuevo', 'original', 'oferta', 'envio', 'gratis',
            'stock', 'disponible', 'inmediato'
        ]

        words = query.lower().split()
        words = [w for w in words if w not in stop_words]

        # Limit query length
        query = ' '.join(words)
        if len(query) > 100:
            query = query[:100]

        return query

    def _calculate_confidence(self, query: str, result: MarketSearchResult) -> float:
        """
        Calculate match confidence between query and result.

        Uses multiple signals:
        - Text similarity
        - Brand matching
        - Model number matching
        """
        query_lower = query.lower()
        title_lower = result.title.lower()

        # Base similarity using SequenceMatcher
        base_similarity = SequenceMatcher(None, query_lower, title_lower).ratio()

        # Bonus for matching all query words
        query_words = set(query_lower.split())
        title_words = set(title_lower.split())
        word_overlap = len(query_words & title_words) / len(query_words) if query_words else 0

        # Bonus for matching brand (first word often is brand)
        brand_match = 0
        if query_words and title_words:
            first_query_word = list(query_words)[0]
            if any(first_query_word in tw for tw in title_words):
                brand_match = 0.1

        # Bonus for matching model numbers (alphanumeric patterns)
        model_pattern = r'\b([A-Z]{1,3}\d{2,}[A-Z\d]*)\b'
        query_models = set(re.findall(model_pattern, query.upper()))
        title_models = set(re.findall(model_pattern, result.title.upper()))
        model_match = 0.2 if query_models & title_models else 0

        # Combine scores
        confidence = (
            base_similarity * 0.5 +
            word_overlap * 0.3 +
            brand_match +
            model_match
        )

        return min(confidence, 1.0)


# Register the scraper
from app.scrapers.registry import ScraperRegistry
ScraperRegistry.register(MercadoLibreScraper)
