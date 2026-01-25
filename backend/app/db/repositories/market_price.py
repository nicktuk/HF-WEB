"""Repository for MarketPrice operations."""
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_, func

from app.db.repositories.base import BaseRepository
from app.models.market_price import MarketPrice, MarketPriceStats, PriceSource


class MarketPriceRepository(BaseRepository[MarketPrice]):
    """Repository for market price operations."""

    def __init__(self, db: Session):
        super().__init__(MarketPrice, db)

    def get_valid_prices_for_product(
        self,
        product_id: int,
        hours: int = 48
    ) -> List[MarketPrice]:
        """Get valid market prices for a product from the last N hours."""
        threshold = datetime.utcnow() - timedelta(hours=hours)
        return (
            self.db.query(MarketPrice)
            .filter(
                and_(
                    MarketPrice.product_id == product_id,
                    MarketPrice.is_valid == True,
                    MarketPrice.scraped_at >= threshold
                )
            )
            .order_by(MarketPrice.scraped_at.desc())
            .all()
        )

    def get_prices_by_source(
        self,
        product_id: int,
        source_id: int,
        limit: int = 10
    ) -> List[MarketPrice]:
        """Get recent prices for a product from a specific source."""
        return (
            self.db.query(MarketPrice)
            .filter(
                and_(
                    MarketPrice.product_id == product_id,
                    MarketPrice.source_id == source_id
                )
            )
            .order_by(MarketPrice.scraped_at.desc())
            .limit(limit)
            .all()
        )

    def delete_old_prices(self, days: int = 7) -> int:
        """Delete prices older than N days. Returns count of deleted rows."""
        threshold = datetime.utcnow() - timedelta(days=days)
        count = (
            self.db.query(MarketPrice)
            .filter(MarketPrice.scraped_at < threshold)
            .delete(synchronize_session=False)
        )
        self.db.commit()
        return count

    def mark_outliers(self, product_id: int, price_ids: List[int]) -> int:
        """Mark prices as invalid (outliers)."""
        count = (
            self.db.query(MarketPrice)
            .filter(
                and_(
                    MarketPrice.product_id == product_id,
                    MarketPrice.id.in_(price_ids)
                )
            )
            .update({MarketPrice.is_valid: False}, synchronize_session=False)
        )
        self.db.commit()
        return count


class MarketPriceStatsRepository(BaseRepository[MarketPriceStats]):
    """Repository for market price statistics."""

    def __init__(self, db: Session):
        super().__init__(MarketPriceStats, db)

    def get_by_product(self, product_id: int) -> Optional[MarketPriceStats]:
        """Get stats for a product."""
        return (
            self.db.query(MarketPriceStats)
            .filter(MarketPriceStats.product_id == product_id)
            .first()
        )

    def upsert(self, product_id: int, stats_data: dict) -> MarketPriceStats:
        """Create or update stats for a product."""
        stats = self.get_by_product(product_id)

        if stats:
            for key, value in stats_data.items():
                setattr(stats, key, value)
            self.db.commit()
            self.db.refresh(stats)
        else:
            stats = MarketPriceStats(product_id=product_id, **stats_data)
            self.db.add(stats)
            self.db.commit()
            self.db.refresh(stats)

        return stats


class PriceSourceRepository(BaseRepository[PriceSource]):
    """Repository for price sources."""

    def __init__(self, db: Session):
        super().__init__(PriceSource, db)

    def get_by_name(self, name: str) -> Optional[PriceSource]:
        """Get source by name."""
        return (
            self.db.query(PriceSource)
            .filter(PriceSource.name == name)
            .first()
        )

    def get_active(self) -> List[PriceSource]:
        """Get all active price sources."""
        return (
            self.db.query(PriceSource)
            .filter(PriceSource.is_active == True)
            .all()
        )
