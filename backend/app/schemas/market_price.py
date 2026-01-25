"""Schemas for Market Price Intelligence."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class PriceSourceResponse(BaseModel):
    """Response schema for price source."""
    id: int
    name: str
    display_name: str
    is_active: bool
    rate_limit_per_minute: int

    class Config:
        from_attributes = True


class MarketPriceResponse(BaseModel):
    """Response schema for individual market price."""
    id: int
    source_name: str
    source_display_name: str
    external_title: Optional[str] = None
    external_url: Optional[str] = None
    price: Decimal
    currency: str = "ARS"
    shipping_cost: Optional[Decimal] = None
    seller_name: Optional[str] = None
    seller_reputation: Optional[str] = None
    match_confidence: Decimal
    match_method: Optional[str] = None
    scraped_at: datetime

    class Config:
        from_attributes = True


class SourceBreakdown(BaseModel):
    """Price breakdown for a single source."""
    source_name: str
    source_display_name: str
    avg_price: Optional[Decimal] = None
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    count: int = 0


class MarketPriceStatsResponse(BaseModel):
    """Response schema for market price statistics."""
    product_id: int
    avg_price: Optional[Decimal] = None
    min_price: Optional[Decimal] = None
    max_price: Optional[Decimal] = None
    median_price: Optional[Decimal] = None
    sample_count: int = 0
    outlier_count: int = 0
    sources_count: int = 0
    breakdown_by_source: List[SourceBreakdown] = []
    last_updated: Optional[datetime] = None

    # Price comparison helpers
    @property
    def price_range(self) -> Optional[Decimal]:
        if self.min_price and self.max_price:
            return self.max_price - self.min_price
        return None

    class Config:
        from_attributes = True


class MarketPriceRefreshRequest(BaseModel):
    """Request to refresh market prices for a product."""
    force: bool = Field(default=False, description="Force refresh even if recently updated")
    search_query: Optional[str] = Field(
        None,
        max_length=200,
        description="Custom search query (defaults to product name)"
    )


class PriceComparisonResponse(BaseModel):
    """Response showing how the product price compares to market."""
    product_id: int
    product_name: str
    your_price: Optional[Decimal] = None

    market_avg: Optional[Decimal] = None
    market_min: Optional[Decimal] = None
    market_max: Optional[Decimal] = None

    # Comparison metrics
    vs_avg_percentage: Optional[Decimal] = None  # Positive = above avg
    vs_min_percentage: Optional[Decimal] = None
    vs_max_percentage: Optional[Decimal] = None

    competitiveness: str = Field(
        default="unknown",
        description="competitive, moderate, high, very_high, below_market"
    )

    recommendation: Optional[str] = None

    @classmethod
    def calculate(
        cls,
        product_id: int,
        product_name: str,
        your_price: Optional[Decimal],
        market_stats: "MarketPriceStatsResponse"
    ) -> "PriceComparisonResponse":
        """Calculate comparison metrics."""
        response = cls(
            product_id=product_id,
            product_name=product_name,
            your_price=your_price,
            market_avg=market_stats.avg_price,
            market_min=market_stats.min_price,
            market_max=market_stats.max_price,
        )

        if your_price and market_stats.avg_price:
            diff = your_price - market_stats.avg_price
            response.vs_avg_percentage = (diff / market_stats.avg_price) * 100

            if market_stats.min_price:
                diff_min = your_price - market_stats.min_price
                response.vs_min_percentage = (diff_min / market_stats.min_price) * 100

            if market_stats.max_price:
                diff_max = your_price - market_stats.max_price
                response.vs_max_percentage = (diff_max / market_stats.max_price) * 100

            # Determine competitiveness
            pct = float(response.vs_avg_percentage)
            if pct < -5:
                response.competitiveness = "below_market"
                response.recommendation = "Your price is below market average - good for volume, lower margin"
            elif pct <= 5:
                response.competitiveness = "competitive"
                response.recommendation = "Your price is competitive with the market"
            elif pct <= 15:
                response.competitiveness = "moderate"
                response.recommendation = "Your price is slightly above average"
            elif pct <= 25:
                response.competitiveness = "high"
                response.recommendation = "Your price is above market - may affect conversions"
            else:
                response.competitiveness = "very_high"
                response.recommendation = "Your price is significantly above market"

        return response
