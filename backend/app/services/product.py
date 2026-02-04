"""Service for Product operations."""
from typing import Optional, List, Tuple
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import or_
import logging

from app.db.repositories import ProductRepository, SourceWebsiteRepository
from app.models.product import Product, ProductImage
from app.models.source_website import SourceWebsite
from app.schemas.product import ProductCreate, ProductUpdate, ProductPublicResponse
from app.scrapers.registry import ScraperRegistry
from app.scrapers.base import ScrapedProduct
from app.core.exceptions import NotFoundError, DuplicateError, ScraperError
from app.services.cache import cache

logger = logging.getLogger(__name__)


class ProductService:
    """Business logic for product operations."""

    def __init__(self, db: Session):
        self.db = db
        self.repo = ProductRepository(db)
        self.source_repo = SourceWebsiteRepository(db)

    # Public catalog methods

    def get_public_catalog(
        self,
        page: int = 1,
        limit: int = 20,
        category: Optional[str] = None,
        search: Optional[str] = None,
        featured: Optional[bool] = None,
        immediate_delivery: Optional[bool] = None
    ) -> Tuple[List[ProductPublicResponse], int]:
        """
        Get enabled products for public catalog.

        Returns tuple of (products, total_count).
        Use featured=True to get only featured products (Novedades).
        Use immediate_delivery=True to get only products with immediate delivery.
        """
        skip = (page - 1) * limit

        # Try cache first
        cache_key = f"catalog:{page}:{limit}:{category}:{search}:{featured}:{immediate_delivery}"
        cached_result = cache.get_product(cache_key)
        if cached_result:
            return cached_result

        products = self.repo.get_enabled_products(skip, limit, category, search, featured, immediate_delivery)
        total = self.repo.count_enabled(category, search, featured, immediate_delivery)

        # Transform to public response
        public_products = [self._to_public_response(p) for p in products]

        result = (public_products, total)
        cache.set_product(cache_key, result)

        return result

    def get_public_product(self, slug: str) -> ProductPublicResponse:
        """Get a single enabled product for public view."""
        # Note: Need to search across all source websites
        products = self.db.query(Product).filter(
            Product.slug == slug,
            Product.enabled == True
        ).all()

        if not products:
            raise NotFoundError("Product", slug)

        return self._to_public_response(products[0])

    def _to_public_response(self, product: Product) -> ProductPublicResponse:
        """Convert product to public response format."""
        images = [
            {"id": img.id, "url": img.url, "alt_text": img.alt_text, "is_primary": img.is_primary}
            for img in sorted(product.images, key=lambda x: (not x.is_primary, x.display_order))
        ]

        return ProductPublicResponse(
            id=product.id,
            slug=product.slug,
            name=product.display_name,
            price=product.final_price,
            currency=product.original_currency,
            short_description=product.short_description,
            brand=product.brand,
            category=product.category,
            is_featured=product.is_featured,
            is_immediate_delivery=product.is_immediate_delivery,
            is_check_stock=product.is_check_stock,
            images=images,
            source_url=product.source_url,
        )

    # Admin methods

    def get_all_admin(
        self,
        page: int = 1,
        limit: int = 20,
        enabled: Optional[bool] = None,
        source_website_id: Optional[int] = None,
        search: Optional[str] = None,
        category: Optional[str] = None,
        is_featured: Optional[bool] = None,
        is_immediate_delivery: Optional[bool] = None
    ) -> Tuple[List[Product], int]:
        """Get all products for admin panel."""
        skip = (page - 1) * limit
        products = self.repo.get_all_admin(skip, limit, enabled, source_website_id, search, category, is_featured, is_immediate_delivery)
        total = self.repo.count_admin(enabled, source_website_id, search, category, is_featured, is_immediate_delivery)
        return products, total

    def get_by_id(self, id: int) -> Product:
        """Get product by ID."""
        product = self.repo.get_with_images(id)
        if not product:
            raise NotFoundError("Product", str(id))
        return product

    async def create_from_slug(self, data: ProductCreate) -> Product:
        """
        Create a new product by scraping from source website.

        Args:
            data: ProductCreate with source_website_id and slug

        Returns:
            Created Product

        Raises:
            NotFoundError: If source website not found
            DuplicateError: If product already exists
            ScraperError: If scraping fails
        """
        # Get source website
        source_website = self.source_repo.get(data.source_website_id)
        if not source_website:
            raise NotFoundError("SourceWebsite", str(data.source_website_id))

        # Check for duplicate
        existing = self.repo.get_by_slug(data.source_website_id, data.slug)
        if existing:
            raise DuplicateError("Product", data.slug)

        # Get scraper
        try:
            scraper = ScraperRegistry.get_scraper(source_website.name)
        except ValueError:
            raise ScraperError(
                f"No scraper available for {source_website.name}",
                source=source_website.name
            )

        # Scrape product data
        scraped = await scraper.scrape_product(
            data.slug,
            config=source_website.scraper_config
        )

        # Create product
        product = Product(
            source_website_id=data.source_website_id,
            slug=data.slug,
            source_url=scraped.source_url,
            original_name=scraped.name,
            original_price=Decimal(str(scraped.price)) if scraped.price else None,
            description=scraped.description,
            short_description=scraped.short_description,
            brand=scraped.brand,
            sku=scraped.sku,
            enabled=data.enabled,
            is_featured=True,  # Mark new scraped products as "Nuevo"
            markup_percentage=data.markup_percentage,
            category=data.category or (scraped.categories[0] if scraped.categories else None),
            last_scraped_at=datetime.utcnow(),
        )

        self.db.add(product)
        self.db.flush()  # Get product ID

        # Add images
        for i, img_url in enumerate(scraped.images):
            image = ProductImage(
                product_id=product.id,
                url=img_url,
                original_url=img_url,
                display_order=i,
                is_primary=(i == 0),
            )
            self.db.add(image)

        self.db.commit()
        self.db.refresh(product)

        # Invalidate cache
        cache.invalidate_all_products()

        logger.info(f"Created product {product.slug} from {source_website.name}")
        return product

    def update(self, id: int, data: ProductUpdate) -> Product:
        """Update a product."""
        product = self.get_by_id(id)

        # Validate: cannot enable product without setting a price
        if data.enabled is True:
            # Determine the effective values after this update
            effective_custom_price = data.custom_price if data.custom_price is not None else product.custom_price
            effective_markup = data.markup_percentage if data.markup_percentage is not None else product.markup_percentage

            # Check if there will be a valid price after update
            has_custom_price = effective_custom_price is not None and float(effective_custom_price) > 0
            has_markup = effective_markup is not None and float(effective_markup) > 0

            if not has_custom_price and not has_markup:
                from app.core.exceptions import ValidationError
                raise ValidationError(
                    "No se puede habilitar un producto sin definir un precio. "
                    "Configura un markup o un precio personalizado."
                )

        # Update fields
        if data.enabled is not None:
            product.enabled = data.enabled
        if data.is_featured is not None:
            product.is_featured = data.is_featured
            # When setting featured, remove check_stock
            if data.is_featured:
                product.is_check_stock = False
        if data.is_immediate_delivery is not None:
            product.is_immediate_delivery = data.is_immediate_delivery
            # When setting immediate delivery, remove check_stock
            if data.is_immediate_delivery:
                product.is_check_stock = False
        if data.is_check_stock is not None:
            product.is_check_stock = data.is_check_stock
            # When setting check_stock, remove featured and immediate delivery
            if data.is_check_stock:
                product.is_featured = False
                product.is_immediate_delivery = False
        if data.markup_percentage is not None:
            product.markup_percentage = data.markup_percentage
        if data.custom_name is not None:
            product.custom_name = data.custom_name if data.custom_name else None
        if data.custom_price is not None:
            product.custom_price = data.custom_price if data.custom_price > 0 else None
        if data.display_order is not None:
            product.display_order = data.display_order
        if data.category is not None:
            product.category = data.category if data.category else None
        if data.description is not None:
            product.description = data.description if data.description else None
        if data.short_description is not None:
            product.short_description = data.short_description if data.short_description else None
        if data.brand is not None:
            product.brand = data.brand if data.brand else None
        if data.sku is not None:
            product.sku = data.sku if data.sku else None

        # Update images if provided
        if data.image_urls is not None:
            # Delete existing images
            for img in product.images:
                self.db.delete(img)

            # Add new images
            for i, img_url in enumerate(data.image_urls):
                if img_url:
                    image = ProductImage(
                        product_id=product.id,
                        url=img_url,
                        original_url=img_url,
                        display_order=i,
                        is_primary=(i == 0),
                    )
                    self.db.add(image)

        self.db.commit()
        self.db.refresh(product)

        # Invalidate cache
        cache.invalidate_all_products()

        return product

    async def rescrape(self, id: int) -> Product:
        """Re-scrape product data from source."""
        product = self.get_by_id(id)
        source_website = product.source_website

        try:
            scraper = ScraperRegistry.get_scraper(source_website.name)
            scraped = await scraper.scrape_product(
                product.slug,
                config=source_website.scraper_config
            )

            # Update scraped fields (preserve admin customizations)
            product.original_name = scraped.name
            if scraped.price:
                product.original_price = Decimal(str(scraped.price))
            product.description = scraped.description
            product.short_description = scraped.short_description
            product.brand = scraped.brand or product.brand
            product.sku = scraped.sku or product.sku
            product.last_scraped_at = datetime.utcnow()
            product.scrape_error_count = 0
            product.scrape_last_error = None

            # Update images (replace all)
            for img in product.images:
                self.db.delete(img)

            for i, img_url in enumerate(scraped.images):
                image = ProductImage(
                    product_id=product.id,
                    url=img_url,
                    original_url=img_url,
                    display_order=i,
                    is_primary=(i == 0),
                )
                self.db.add(image)

            self.db.commit()
            self.db.refresh(product)

            cache.invalidate_all_products()

            logger.info(f"Re-scraped product {product.slug}")
            return product

        except Exception as e:
            product.scrape_error_count += 1
            product.scrape_last_error = str(e)
            self.db.commit()
            raise

    def delete(self, id: int) -> None:
        """Delete a product."""
        product = self.get_by_id(id)
        self.repo.delete(product)
        cache.invalidate_all_products()

    def create_manual(self, data) -> Product:
        """
        Create a product manually without scraping.

        Args:
            data: ProductCreateManual with name, price, description, images, etc.

        Returns:
            Created Product
        """
        from app.models.source_website import SourceWebsite

        # Get or create the "manual" source website
        manual_source = self.db.query(SourceWebsite).filter(
            SourceWebsite.name == "manual"
        ).first()

        if not manual_source:
            # Create it if it doesn't exist
            manual_source = SourceWebsite(
                name="manual",
                display_name="Producto Manual",
                base_url="",
                is_active=True,
                scraper_config={},
                notes="Productos creados manualmente sin scraping."
            )
            self.db.add(manual_source)
            self.db.flush()

        # Generate a unique slug from the name
        import re
        import uuid
        base_slug = re.sub(r'[^a-z0-9]+', '-', data.name.lower()).strip('-')
        slug = f"{base_slug}-{uuid.uuid4().hex[:8]}"

        # Create product
        product = Product(
            source_website_id=manual_source.id,
            slug=slug,
            source_url=None,
            original_name=data.name,
            original_price=None,  # Manual products use custom_price
            custom_price=data.price,
            description=data.description,
            short_description=data.short_description,
            brand=data.brand,
            sku=data.sku,
            enabled=data.enabled,
            is_featured=data.is_featured,
            is_immediate_delivery=data.is_immediate_delivery,
            markup_percentage=Decimal("0"),
            category=data.category,
            last_scraped_at=None,
        )

        self.db.add(product)
        self.db.flush()

        # Add images
        for i, img_url in enumerate(data.image_urls):
            image = ProductImage(
                product_id=product.id,
                url=img_url,
                original_url=img_url,
                display_order=i,
                is_primary=(i == 0),
            )
            self.db.add(image)

        self.db.commit()
        self.db.refresh(product)

        cache.invalidate_all_products()

        logger.info(f"Created manual product: {product.slug}")
        return product

    def bulk_enable(self, product_ids: List[int], enabled: bool) -> int:
        """Bulk enable/disable products."""
        count = self.repo.bulk_update_enabled(product_ids, enabled)
        cache.invalidate_all_products()
        return count

    def bulk_set_markup(
        self,
        markup_percentage: Decimal,
        only_enabled: bool = True,
        source_website_id: Optional[int] = None
    ) -> int:
        """Set markup percentage for multiple products."""
        query = self.db.query(Product)
        if only_enabled:
            query = query.filter(Product.enabled == True)
        if source_website_id:
            query = query.filter(Product.source_website_id == source_website_id)

        count = query.update(
            {Product.markup_percentage: markup_percentage},
            synchronize_session=False
        )
        self.db.commit()
        cache.invalidate_all_products()
        return count

    def activate_all_inactive_with_markup(self, markup_percentage: Decimal) -> int:
        """
        Activate all inactive products and apply markup.

        Returns the number of products activated.
        """
        count = self.db.query(Product).filter(
            Product.enabled == False
        ).update(
            {
                Product.enabled: True,
                Product.markup_percentage: markup_percentage
            },
            synchronize_session=False
        )
        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Activated {count} products with {markup_percentage}% markup")
        return count

    def activate_selected_with_markup(
        self,
        product_ids: List[int],
        markup_percentage: Decimal,
        category: Optional[str] = None
    ) -> dict:
        """
        Activate selected products and apply markup.
        Only activates products with valid price (not null, not 0).

        Returns dict with 'activated' count and 'skipped' count.
        """
        update_data = {
            Product.enabled: True,
            Product.markup_percentage: markup_percentage
        }
        if category:
            update_data[Product.category] = category

        # Only activate products with valid price (not null and > 0)
        count = self.db.query(Product).filter(
            Product.id.in_(product_ids),
            Product.original_price.isnot(None),
            Product.original_price > 0
        ).update(update_data, synchronize_session=False)

        # Count how many were skipped (no valid price)
        skipped = self.db.query(Product).filter(
            Product.id.in_(product_ids),
            or_(
                Product.original_price.is_(None),
                Product.original_price <= 0
            )
        ).count()

        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Activated {count} products (skipped {skipped} without valid price), markup: {markup_percentage}%, category: {category}")
        return {"activated": count, "skipped": skipped}

    def change_category_selected(self, product_ids: List[int], category: str) -> int:
        """
        Change category for selected products.

        Returns the number of products updated.
        """
        count = self.db.query(Product).filter(
            Product.id.in_(product_ids)
        ).update(
            {Product.category: category},
            synchronize_session=False
        )
        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Changed category to '{category}' for {count} products")
        return count

    def disable_selected(self, product_ids: List[int]) -> int:
        """
        Disable selected products.

        Returns the number of products disabled.
        """
        count = self.db.query(Product).filter(
            Product.id.in_(product_ids)
        ).update(
            {Product.enabled: False},
            synchronize_session=False
        )
        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Disabled {count} products")
        return count

    def disable_all_from_source(self, source_website_id: int) -> int:
        """
        Disable ALL products from a source website.

        Returns the number of products disabled.
        """
        count = self.db.query(Product).filter(
            Product.source_website_id == source_website_id,
            Product.enabled == True
        ).update(
            {Product.enabled: False},
            synchronize_session=False
        )
        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Disabled {count} products from source {source_website_id}")
        return count

    def delete_all_from_source(self, source_website_id: int) -> int:
        """
        DELETE ALL products from a source website.

        Returns the number of products deleted.
        """
        count = self.db.query(Product).filter(
            Product.source_website_id == source_website_id
        ).delete(synchronize_session=False)
        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Deleted {count} products from source {source_website_id}")
        return count

    def check_stock_all_from_source(self, source_website_id: int) -> int:
        """
        Set is_check_stock=True for ALL enabled products from a source website.
        Also removes is_featured and is_immediate_delivery flags.

        Returns the number of products updated.
        """
        count = self.db.query(Product).filter(
            Product.source_website_id == source_website_id,
            Product.enabled == True
        ).update(
            {
                Product.is_check_stock: True,
                Product.is_featured: False,
                Product.is_immediate_delivery: False
            },
            synchronize_session=False
        )
        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Set check_stock for {count} products from source {source_website_id}")
        return count

    def get_categories(self) -> List[str]:
        """Get list of unique categories."""
        return self.repo.get_categories()

    def get_public_categories(self) -> List[dict]:
        """Get list of categories with their properties for public display."""
        from app.models.category import Category as CategoryModel

        categories = (
            self.db.query(CategoryModel)
            .filter(CategoryModel.is_active == True)
            .order_by(CategoryModel.display_order, CategoryModel.name)
            .all()
        )

        return [
            {
                "name": cat.name,
                "color": cat.color or "#6b7280",
                "show_in_menu": cat.show_in_menu or False,
            }
            for cat in categories
        ]

    def get_enabled_products(self) -> List[Product]:
        """Get all enabled products with images for PDF export."""
        return self.db.query(Product).filter(
            Product.enabled == True
        ).order_by(Product.category, Product.original_name).all()

    async def scrape_all_from_source(
        self,
        source_website_id: int,
        update_existing: bool = True
    ) -> dict:
        """
        Scrape all products from a source website.

        - Finds all products in the source catalog
        - Creates new products (disabled by default)
        - Optionally updates existing products

        Args:
            source_website_id: ID of the source website
            update_existing: Whether to update existing products

        Returns:
            Dict with counts: {new: int, updated: int, errors: int, total: int}
        """
        source_website = self.source_repo.get(source_website_id)
        if not source_website:
            raise NotFoundError("SourceWebsite", str(source_website_id))

        try:
            scraper = ScraperRegistry.get_scraper(source_website.name)
        except ValueError:
            raise ScraperError(
                f"No scraper available for {source_website.name}",
                source=source_website.name
            )

        # Get all slugs from catalog
        logger.info(f"Fetching catalog from {source_website.name}...")
        all_slugs = await scraper.scrape_catalog(config=source_website.scraper_config)
        logger.info(f"Found {len(all_slugs)} products in catalog")

        results = {"new": 0, "updated": 0, "errors": 0, "total": len(all_slugs)}

        for slug in all_slugs:
            try:
                existing = self.repo.get_by_slug(source_website_id, slug)

                if existing:
                    if update_existing:
                        # Update existing product
                        await self.rescrape(existing.id)
                        results["updated"] += 1
                        logger.info(f"Updated: {slug}")
                else:
                    # Create new product (disabled by default)
                    scraped = await scraper.scrape_product(
                        slug,
                        config=source_website.scraper_config
                    )

                    product = Product(
                        source_website_id=source_website_id,
                        slug=slug,
                        source_url=scraped.source_url,
                        original_name=scraped.name,
                        original_price=Decimal(str(scraped.price)) if scraped.price else None,
                        description=scraped.description,
                        short_description=scraped.short_description,
                        brand=scraped.brand,
                        sku=scraped.sku,
                        enabled=False,  # Disabled by default - admin enables manually
                        is_featured=True,  # Mark new scraped products as "Nuevo"
                        markup_percentage=Decimal("0"),
                        category=scraped.categories[0] if scraped.categories else None,
                        last_scraped_at=datetime.utcnow(),
                    )

                    self.db.add(product)
                    self.db.flush()

                    # Add images
                    for i, img_url in enumerate(scraped.images):
                        image = ProductImage(
                            product_id=product.id,
                            url=img_url,
                            original_url=img_url,
                            display_order=i,
                            is_primary=(i == 0),
                        )
                        self.db.add(image)

                    self.db.commit()
                    results["new"] += 1
                    logger.info(f"Created: {slug}")

            except Exception as e:
                results["errors"] += 1
                logger.error(f"Error processing {slug}: {e}")
                self.db.rollback()
                continue

        cache.invalidate_all_products()
        logger.info(f"Scrape complete: {results}")
        return results

    def compare_prices(self, search: str, similarity_threshold: int = 70) -> dict:
        """
        Compare prices across source websites for products matching search term.
        Groups similar products using fuzzy matching.

        Args:
            search: Search keyword
            similarity_threshold: Minimum similarity score (0-100) to group products

        Returns:
            dict with:
            - sources: list of source websites with products matching search
            - groups: list of product groups (similar products grouped together)
        """
        from rapidfuzz import fuzz
        import re

        search_term = f"%{search}%"

        # Get all products matching the search
        products = (
            self.db.query(Product)
            .filter(
                or_(
                    Product.original_name.ilike(search_term),
                    Product.custom_name.ilike(search_term),
                    Product.sku.ilike(search_term),
                    Product.slug.ilike(search_term)
                )
            )
            .all()
        )

        if not products:
            return {"sources": [], "groups": [], "total": 0}

        # Get all source websites that have matching products
        source_ids = set(p.source_website_id for p in products if p.source_website_id)
        sources = self.source_repo.get_by_ids(list(source_ids))

        # Build source map
        source_map = {s.id: {"id": s.id, "name": s.display_name or s.name} for s in sources}

        def normalize_name(name: str) -> str:
            """Normalize product name for better comparison."""
            if not name:
                return ""
            # Lowercase
            name = name.lower()
            # Remove common words that don't help comparison
            stopwords = ['de', 'el', 'la', 'los', 'las', 'un', 'una', 'con', 'para', 'por']
            words = name.split()
            words = [w for w in words if w not in stopwords]
            # Remove special characters
            name = ' '.join(words)
            name = re.sub(r'[^\w\s]', '', name)
            return name.strip()

        def build_product_data(p: Product) -> dict:
            """Build product dict for response."""
            primary_image = None
            for img in p.images:
                if img.is_primary:
                    primary_image = img.url
                    break
            if not primary_image and p.images:
                primary_image = p.images[0].url

            return {
                "id": p.id,
                "name": p.display_name,
                "original_name": p.original_name,
                "sku": p.sku,
                "slug": p.slug,
                "source_website_id": p.source_website_id,
                "source_name": source_map.get(p.source_website_id, {}).get("name", "Desconocido"),
                "original_price": float(p.original_price) if p.original_price else None,
                "final_price": float(p.final_price) if p.final_price else None,
                "markup_percentage": float(p.markup_percentage) if p.markup_percentage else 0,
                "enabled": p.enabled,
                "image": primary_image,
            }

        # Group products by similarity
        groups = []
        used_ids = set()

        for product in products:
            if product.id in used_ids:
                continue

            # Start a new group with this product
            group = {
                "name": product.display_name,
                "products": [build_product_data(product)]
            }
            used_ids.add(product.id)

            normalized_name = normalize_name(product.original_name)

            # Find similar products from other sources
            for other in products:
                if other.id in used_ids:
                    continue
                # Skip products from the same source
                if other.source_website_id == product.source_website_id:
                    continue

                other_normalized = normalize_name(other.original_name)

                # Calculate similarity
                similarity = fuzz.token_sort_ratio(normalized_name, other_normalized)

                if similarity >= similarity_threshold:
                    group["products"].append(build_product_data(other))
                    used_ids.add(other.id)

            groups.append(group)

        # Sort groups by number of sources (more sources = more interesting comparison)
        groups.sort(key=lambda g: len(g["products"]), reverse=True)

        return {
            "sources": list(source_map.values()),
            "groups": groups,
            "total": len(products)
        }

    def get_stats_by_source_and_category(self) -> dict:
        """
        Get product stats grouped by source website and category.

        Returns:
            dict with:
            - sources: list of source websites
            - categories: list of unique categories
            - stats: list of {source_id, source_name, category, enabled_count, total_count}
            - chart_data: data formatted for stacked bar chart
        """
        from sqlalchemy import func, case

        # Get all source websites
        sources = self.source_repo.get_all()
        source_map = {s.id: s.display_name or s.name for s in sources}

        # Query stats grouped by source and category
        stats_query = (
            self.db.query(
                Product.source_website_id,
                Product.category,
                func.count(Product.id).label('total'),
                func.sum(case((Product.enabled == True, 1), else_=0)).label('enabled')
            )
            .group_by(Product.source_website_id, Product.category)
            .all()
        )

        # Build stats list
        stats = []
        categories_set = set()

        for row in stats_query:
            source_id = row.source_website_id
            category = row.category or "Sin categoría"
            categories_set.add(category)

            stats.append({
                "source_id": source_id,
                "source_name": source_map.get(source_id, "Desconocido"),
                "category": category,
                "enabled_count": int(row.enabled or 0),
                "total_count": int(row.total or 0),
            })

        # Sort categories alphabetically, but "Sin categoría" at the end
        categories = sorted([c for c in categories_set if c != "Sin categoría"])
        if "Sin categoría" in categories_set:
            categories.append("Sin categoría")

        # Build chart data (for stacked bar chart)
        # Format: [{source: "RedLenic", "Bazar": 10, "Audio": 5, ...}, ...]
        chart_data = []
        for source in sources:
            source_stats = {"source": source.display_name or source.name}
            for stat in stats:
                if stat["source_id"] == source.id:
                    source_stats[stat["category"]] = stat["enabled_count"]
            chart_data.append(source_stats)

        return {
            "sources": [{"id": s.id, "name": s.display_name or s.name} for s in sources],
            "categories": categories,
            "stats": stats,
            "chart_data": chart_data,
        }
