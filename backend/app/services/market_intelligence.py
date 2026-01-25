"""Service for Market Price Intelligence."""
from typing import Optional, List
from datetime import datetime, timedelta
from decimal import Decimal
import statistics
from sqlalchemy.orm import Session
import logging

from app.db.repositories.market_price import (
    MarketPriceRepository,
    MarketPriceStatsRepository,
    PriceSourceRepository,
)
from app.db.repositories.product import ProductRepository
from app.models.market_price import MarketPrice, MarketPriceStats, PriceSource
from app.models.product import Product
from app.schemas.market_price import (
    MarketPriceStatsResponse,
    PriceComparisonResponse,
    SourceBreakdown,
)
from app.scrapers.registry import ScraperRegistry
from app.scrapers.market.mercadolibre import MercadoLibreScraper
from app.core.exceptions import NotFoundError
from app.services.cache import cache

logger = logging.getLogger(__name__)


class MarketIntelligenceService:
    """
    Service for gathering and analyzing market prices.

    Responsibilities:
    - Search external sources for comparable products
    - Store and aggregate price data
    - Calculate statistics and recommendations
    """

    def __init__(self, db: Session):
        self.db = db
        self.price_repo = MarketPriceRepository(db)
        self.stats_repo = MarketPriceStatsRepository(db)
        self.source_repo = PriceSourceRepository(db)
        self.product_repo = ProductRepository(db)

    async def refresh_market_prices(
        self,
        product_id: int,
        force: bool = False,
        search_query: Optional[str] = None
    ) -> MarketPriceStatsResponse:
        """
        Refresh market prices for a product.

        Args:
            product_id: Product ID
            force: Force refresh even if recently updated
            search_query: Custom search query (defaults to product name)

        Returns:
            Updated market price statistics
        """
        product = self.product_repo.get(product_id)
        if not product:
            raise NotFoundError("Product", str(product_id))

        # Check if recently updated (unless force)
        if not force:
            stats = self.stats_repo.get_by_product(product_id)
            if stats and stats.updated_at:
                if datetime.utcnow() - stats.updated_at < timedelta(hours=12):
                    return self._build_stats_response(stats)

        # Build search query
        query = search_query or self._build_search_query(product)

        # Search each active source
        active_sources = self.source_repo.get_active()
        all_results = []

        for source in active_sources:
            try:
                results = await self._search_source(source, query)
                all_results.extend(results)
            except Exception as e:
                logger.error(f"Error searching {source.name}: {e}")
                continue

        # Store results
        for result in all_results:
            source = self.source_repo.get_by_name(result.source_name)
            if not source:
                continue

            market_price = MarketPrice(
                product_id=product_id,
                source_id=source.id,
                external_title=result.title,
                external_url=result.url,
                price=Decimal(str(result.price)),
                currency=result.currency,
                shipping_cost=Decimal(str(result.shipping_cost)) if result.shipping_cost else None,
                seller_name=result.seller_name,
                seller_reputation=result.seller_reputation,
                match_confidence=Decimal(str(result.match_confidence)),
                match_method=result.match_method,
                scraped_at=datetime.utcnow(),
            )
            self.db.add(market_price)

        self.db.commit()

        # Recalculate statistics
        stats = await self._recalculate_stats(product_id)

        # Invalidate cache
        cache.invalidate_market(f"stats:{product_id}")

        return self._build_stats_response(stats)

    async def _search_source(self, source: PriceSource, query: str) -> List:
        """Search a specific price source."""
        try:
            scraper = ScraperRegistry.get_scraper(source.name)

            if isinstance(scraper, MercadoLibreScraper):
                return await scraper.search_products(query, limit=10, min_confidence=0.5)

            # Add handling for other scraper types here

            return []

        except ValueError:
            logger.warning(f"No scraper found for source: {source.name}")
            return []

    def _build_search_query(self, product: Product) -> str:
        """Build optimal search query from product data."""
        parts = []

        # Add brand if available
        if product.brand:
            parts.append(product.brand)

        # Add product name (cleaned)
        name = product.original_name

        # Remove common noise words
        noise_words = ['nuevo', 'original', 'oficial', 'garantia', 'envio', 'gratis']
        name_words = name.split()
        name_words = [w for w in name_words if w.lower() not in noise_words]
        name = ' '.join(name_words[:6])  # Limit to first 6 words

        parts.append(name)

        # Add SKU/model if available and looks like a model number
        if product.sku and len(product.sku) > 3:
            parts.append(product.sku)

        query = ' '.join(parts)

        # Limit total length
        if len(query) > 80:
            query = query[:80]

        return query

    async def _recalculate_stats(self, product_id: int) -> MarketPriceStats:
        """Recalculate price statistics for a product."""
        # Get valid prices from last 48 hours
        prices = self.price_repo.get_valid_prices_for_product(product_id, hours=48)

        if not prices:
            # Return empty stats
            return self.stats_repo.upsert(product_id, {
                "avg_price": None,
                "min_price": None,
                "max_price": None,
                "median_price": None,
                "sample_count": 0,
                "outlier_count": 0,
                "sources_count": 0,
                "breakdown_by_source": {},
            })

        # Extract price values
        price_values = [float(p.price) for p in prices]

        # Detect and exclude outliers using IQR method
        outlier_ids = self._detect_outliers(prices)
        if outlier_ids:
            self.price_repo.mark_outliers(product_id, outlier_ids)
            # Filter out outliers
            valid_prices = [p for p in prices if p.id not in outlier_ids]
            price_values = [float(p.price) for p in valid_prices]
        else:
            valid_prices = prices

        # Calculate statistics
        if price_values:
            avg_price = statistics.mean(price_values)
            min_price = min(price_values)
            max_price = max(price_values)
            median_price = statistics.median(price_values)
        else:
            avg_price = min_price = max_price = median_price = None

        # Calculate breakdown by source
        breakdown = self._calculate_source_breakdown(valid_prices)

        # Count unique sources
        sources_count = len(set(p.source_id for p in valid_prices))

        stats_data = {
            "avg_price": Decimal(str(avg_price)) if avg_price else None,
            "min_price": Decimal(str(min_price)) if min_price else None,
            "max_price": Decimal(str(max_price)) if max_price else None,
            "median_price": Decimal(str(median_price)) if median_price else None,
            "sample_count": len(valid_prices),
            "outlier_count": len(outlier_ids),
            "sources_count": sources_count,
            "breakdown_by_source": breakdown,
        }

        return self.stats_repo.upsert(product_id, stats_data)

    def _detect_outliers(self, prices: List[MarketPrice]) -> List[int]:
        """Detect outlier prices using IQR method."""
        if len(prices) < 4:
            return []

        price_values = sorted([float(p.price) for p in prices])

        q1_idx = len(price_values) // 4
        q3_idx = (3 * len(price_values)) // 4

        q1 = price_values[q1_idx]
        q3 = price_values[q3_idx]
        iqr = q3 - q1

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        outlier_ids = []
        for price in prices:
            price_val = float(price.price)
            if price_val < lower_bound or price_val > upper_bound:
                outlier_ids.append(price.id)

        return outlier_ids

    def _calculate_source_breakdown(self, prices: List[MarketPrice]) -> dict:
        """Calculate price statistics by source."""
        from collections import defaultdict

        by_source = defaultdict(list)
        for price in prices:
            by_source[price.source_id].append(float(price.price))

        breakdown = {}
        for source_id, values in by_source.items():
            source = self.source_repo.get(source_id)
            if source:
                breakdown[source.name] = {
                    "avg": round(statistics.mean(values), 2),
                    "min": round(min(values), 2),
                    "max": round(max(values), 2),
                    "count": len(values),
                }

        return breakdown

    def get_stats(self, product_id: int) -> Optional[MarketPriceStatsResponse]:
        """Get cached or stored market price stats."""
        # Try cache first
        cache_key = f"stats:{product_id}"
        cached = cache.get_market(cache_key)
        if cached:
            return cached

        stats = self.stats_repo.get_by_product(product_id)
        if not stats:
            return None

        response = self._build_stats_response(stats)
        cache.set_market(cache_key, response)
        return response

    def _build_stats_response(self, stats: MarketPriceStats) -> MarketPriceStatsResponse:
        """Build response from stats model."""
        breakdown = []
        if stats.breakdown_by_source:
            for source_name, data in stats.breakdown_by_source.items():
                source = self.source_repo.get_by_name(source_name)
                breakdown.append(SourceBreakdown(
                    source_name=source_name,
                    source_display_name=source.display_name if source else source_name,
                    avg_price=Decimal(str(data["avg"])) if data.get("avg") else None,
                    min_price=Decimal(str(data["min"])) if data.get("min") else None,
                    max_price=Decimal(str(data["max"])) if data.get("max") else None,
                    count=data.get("count", 0),
                ))

        return MarketPriceStatsResponse(
            product_id=stats.product_id,
            avg_price=stats.avg_price,
            min_price=stats.min_price,
            max_price=stats.max_price,
            median_price=stats.median_price,
            sample_count=stats.sample_count,
            outlier_count=stats.outlier_count,
            sources_count=stats.sources_count,
            breakdown_by_source=breakdown,
            last_updated=stats.updated_at,
        )

    def get_price_comparison(self, product_id: int) -> PriceComparisonResponse:
        """Get price comparison for a product."""
        product = self.product_repo.get(product_id)
        if not product:
            raise NotFoundError("Product", str(product_id))

        stats = self.get_stats(product_id)
        if not stats:
            stats = MarketPriceStatsResponse(product_id=product_id)

        return PriceComparisonResponse.calculate(
            product_id=product_id,
            product_name=product.display_name,
            your_price=product.final_price,
            market_stats=stats,
        )
