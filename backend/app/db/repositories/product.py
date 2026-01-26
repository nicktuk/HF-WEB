"""Repository for Product operations."""
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_

from app.db.repositories.base import BaseRepository
from app.models.product import Product, ProductImage


class ProductRepository(BaseRepository[Product]):
    """Repository for product operations."""

    def __init__(self, db: Session):
        super().__init__(Product, db)

    def get_with_images(self, id: int) -> Optional[Product]:
        """Get product with eager loaded images."""
        return (
            self.db.query(Product)
            .options(joinedload(Product.images))
            .filter(Product.id == id)
            .first()
        )

    def get_by_slug(self, source_website_id: int, slug: str) -> Optional[Product]:
        """Get product by source website and slug (unique combination)."""
        return (
            self.db.query(Product)
            .filter(
                and_(
                    Product.source_website_id == source_website_id,
                    Product.slug == slug
                )
            )
            .first()
        )

    def get_enabled_products(
        self,
        skip: int = 0,
        limit: int = 100,
        category: Optional[str] = None,
        search: Optional[str] = None,
        featured: Optional[bool] = None
    ) -> List[Product]:
        """Get enabled products for public catalog."""
        query = (
            self.db.query(Product)
            .options(joinedload(Product.images))
            .filter(Product.enabled == True)
        )

        if category:
            query = query.filter(Product.category == category)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Product.original_name.ilike(search_term),
                    Product.custom_name.ilike(search_term),
                    Product.description.ilike(search_term)
                )
            )

        if featured is not None:
            query = query.filter(Product.is_featured == featured)

        return (
            query
            .order_by(Product.display_order, Product.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def count_enabled(
        self,
        category: Optional[str] = None,
        search: Optional[str] = None,
        featured: Optional[bool] = None
    ) -> int:
        """Count enabled products."""
        query = self.db.query(Product).filter(Product.enabled == True)

        if category:
            query = query.filter(Product.category == category)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Product.original_name.ilike(search_term),
                    Product.custom_name.ilike(search_term)
                )
            )

        if featured is not None:
            query = query.filter(Product.is_featured == featured)

        return query.count()

    def get_all_admin(
        self,
        skip: int = 0,
        limit: int = 100,
        enabled: Optional[bool] = None,
        source_website_id: Optional[int] = None,
        search: Optional[str] = None,
        category: Optional[str] = None
    ) -> List[Product]:
        """Get all products for admin panel."""
        query = (
            self.db.query(Product)
            .options(
                joinedload(Product.images),
                joinedload(Product.source_website),
                joinedload(Product.market_price_stats)
            )
        )

        if enabled is not None:
            query = query.filter(Product.enabled == enabled)

        if source_website_id:
            query = query.filter(Product.source_website_id == source_website_id)

        if category:
            query = query.filter(Product.category == category)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Product.original_name.ilike(search_term),
                    Product.custom_name.ilike(search_term),
                    Product.slug.ilike(search_term)
                )
            )

        return (
            query
            .order_by(Product.created_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_products_needing_rescrape(self, hours: int = 24) -> List[Product]:
        """Get enabled products that need to be re-scraped."""
        threshold = datetime.utcnow() - timedelta(hours=hours)
        return (
            self.db.query(Product)
            .filter(
                and_(
                    Product.enabled == True,
                    or_(
                        Product.last_scraped_at < threshold,
                        Product.last_scraped_at == None
                    )
                )
            )
            .all()
        )

    def get_by_source_website(self, source_website_id: int) -> List[Product]:
        """Get all products from a specific source website."""
        return (
            self.db.query(Product)
            .filter(Product.source_website_id == source_website_id)
            .all()
        )

    def get_categories(self, only_enabled: bool = True) -> List[str]:
        """Get list of unique categories from enabled products."""
        query = self.db.query(Product.category).filter(Product.category != None)

        if only_enabled:
            query = query.filter(Product.enabled == True)

        result = query.distinct().all()
        return sorted([r[0] for r in result if r[0]])

    def bulk_update_enabled(self, product_ids: List[int], enabled: bool) -> int:
        """Bulk update enabled status. Returns count of updated rows."""
        count = (
            self.db.query(Product)
            .filter(Product.id.in_(product_ids))
            .update({Product.enabled: enabled}, synchronize_session=False)
        )
        self.db.commit()
        return count

    def count_admin(
        self,
        enabled: Optional[bool] = None,
        source_website_id: Optional[int] = None,
        search: Optional[str] = None,
        category: Optional[str] = None
    ) -> int:
        """Count products with filters for admin panel."""
        query = self.db.query(Product)

        if enabled is not None:
            query = query.filter(Product.enabled == enabled)

        if source_website_id:
            query = query.filter(Product.source_website_id == source_website_id)

        if category:
            query = query.filter(Product.category == category)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Product.original_name.ilike(search_term),
                    Product.custom_name.ilike(search_term),
                    Product.slug.ilike(search_term)
                )
            )

        return query.count()
