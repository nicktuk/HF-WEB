"""Repository for Product operations."""
from typing import Optional, List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, case

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
        subcategory: Optional[str] = None,
        search: Optional[str] = None,
        featured: Optional[bool] = None,
        immediate_delivery: Optional[bool] = None
    ) -> List[Product]:
        """Get enabled products for public catalog."""
        query = (
            self.db.query(Product)
            .options(joinedload(Product.images))
            .filter(Product.enabled == True)
        )

        if category:
            query = query.filter(Product.category == category)

        if subcategory:
            query = query.filter(Product.subcategory == subcategory)

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

        if immediate_delivery is not None:
            query = query.filter(Product.is_immediate_delivery == immediate_delivery)

        if category:
            immediate_first = case(
                (Product.is_immediate_delivery == True, 1),
                else_=0
            )
            query = query.order_by(
                immediate_first.desc(),
                Product.display_order,
                Product.created_at.desc()
            )
        else:
            query = query.order_by(Product.display_order, Product.created_at.desc())

        return query.offset(skip).limit(limit).all()

    def count_enabled(
        self,
        category: Optional[str] = None,
        subcategory: Optional[str] = None,
        search: Optional[str] = None,
        featured: Optional[bool] = None,
        immediate_delivery: Optional[bool] = None
    ) -> int:
        """Count enabled products."""
        query = self.db.query(Product).filter(Product.enabled == True)

        if category:
            query = query.filter(Product.category == category)

        if subcategory:
            query = query.filter(Product.subcategory == subcategory)

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

        if immediate_delivery is not None:
            query = query.filter(Product.is_immediate_delivery == immediate_delivery)

        return query.count()

    def get_all_admin(
        self,
        skip: int = 0,
        limit: int = 100,
        enabled: Optional[bool] = None,
        source_website_id: Optional[int] = None,
        search: Optional[str] = None,
        category: Optional[str] = None,
        subcategory: Optional[str] = None,
        is_featured: Optional[bool] = None,
        is_immediate_delivery: Optional[bool] = None,
        price_range: Optional[str] = None
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
            if category == "__none__":
                query = query.filter(Product.category == None)
            else:
                query = query.filter(Product.category == category)

        if subcategory:
            if subcategory == "__none__":
                query = query.filter(Product.subcategory == None)
            else:
                query = query.filter(Product.subcategory == subcategory)

        if is_featured is not None:
            query = query.filter(Product.is_featured == is_featured)

        if is_immediate_delivery is not None:
            query = query.filter(Product.is_immediate_delivery == is_immediate_delivery)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Product.original_name.ilike(search_term),
                    Product.custom_name.ilike(search_term),
                    Product.slug.ilike(search_term)
                )
            )

        # Price range filter
        if price_range:
            query = self._apply_price_range_filter(query, price_range)

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
        category: Optional[str] = None,
        subcategory: Optional[str] = None,
        is_featured: Optional[bool] = None,
        is_immediate_delivery: Optional[bool] = None,
        price_range: Optional[str] = None
    ) -> int:
        """Count products with filters for admin panel."""
        query = self.db.query(Product)

        if enabled is not None:
            query = query.filter(Product.enabled == enabled)

        if source_website_id:
            query = query.filter(Product.source_website_id == source_website_id)

        if category:
            if category == "__none__":
                query = query.filter(Product.category == None)
            else:
                query = query.filter(Product.category == category)

        if subcategory:
            if subcategory == "__none__":
                query = query.filter(Product.subcategory == None)
            else:
                query = query.filter(Product.subcategory == subcategory)

        if is_featured is not None:
            query = query.filter(Product.is_featured == is_featured)

        if is_immediate_delivery is not None:
            query = query.filter(Product.is_immediate_delivery == is_immediate_delivery)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                or_(
                    Product.original_name.ilike(search_term),
                    Product.custom_name.ilike(search_term),
                    Product.slug.ilike(search_term)
                )
            )

        # Price range filter
        if price_range:
            query = self._apply_price_range_filter(query, price_range)

        return query.count()

    def _apply_price_range_filter(self, query, price_range: str):
        """Apply price range filter to query.

        Ranges:
        - 0-5000: $0 to $5,000
        - 5001-20000: $5,001 to $20,000
        - 20001-80000: $20,001 to $80,000
        - 80001+: greater than $80,000
        """
        if price_range == "0-5000":
            query = query.filter(
                and_(
                    Product.original_price >= 0,
                    Product.original_price <= 5000
                )
            )
        elif price_range == "5001-20000":
            query = query.filter(
                and_(
                    Product.original_price >= 5001,
                    Product.original_price <= 20000
                )
            )
        elif price_range == "20001-80000":
            query = query.filter(
                and_(
                    Product.original_price >= 20001,
                    Product.original_price <= 80000
                )
            )
        elif price_range == "80001+":
            query = query.filter(Product.original_price > 80000)

        return query
