"""Service for Product operations."""
from typing import Optional, List, Tuple
from datetime import datetime, date, timedelta
from decimal import Decimal, InvalidOperation
import csv
import io
import re
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, func, case
import logging

from app.db.repositories import ProductRepository, SourceWebsiteRepository
from app.models.product import Product, ProductImage
from app.models.category import Category
from app.models.category_mapping import CategoryMapping
from app.models.stock import StockPurchase
from app.models.sale import Sale, SaleItem
from app.models.source_website import SourceWebsite
from app.models.analytics_event import AnalyticsEvent
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
        subcategory: Optional[str] = None,
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
        cache_key = f"catalog:{page}:{limit}:{category}:{subcategory}:{search}:{featured}:{immediate_delivery}"
        cached_result = cache.get_product(cache_key)
        if cached_result:
            return cached_result

        products = self.repo.get_enabled_products(skip, limit, category, subcategory, search, featured, immediate_delivery)
        total = self.repo.count_enabled(category, subcategory, search, featured, immediate_delivery)

        # Transform to public response
        public_products = [self._to_public_response(p) for p in products]

        result = (public_products, total)
        cache.set_product(cache_key, result)

        return result

    def get_public_product(self, slug: str) -> ProductPublicResponse:
        """Get a single enabled product for public view."""
        products = (
            self.db.query(Product)
            .join(Category, Product.category_id == Category.id)
            .filter(
                Product.slug == slug,
                Product.enabled == True,
                Category.is_active == True,
            )
            .all()
        )

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
            category=product.category_ref.name if product.category_ref else None,
            category_id=product.category_id,
            subcategory=product.subcategory,
            is_featured=product.is_featured,
            is_immediate_delivery=product.is_immediate_delivery,
            is_check_stock=product.is_check_stock,
            is_best_seller=product.is_best_seller,
            images=images,
            source_url=product.source_url,
        )

    @staticmethod
    def _normalize_source_category(value: Optional[str]) -> str:
        raw = (value or "").strip().lower()
        return re.sub(r"\s+", " ", raw)

    def _get_category_by_name(self, category_name: Optional[str]) -> Optional[Category]:
        if not category_name:
            return None
        return self.db.query(Category).filter(Category.name == category_name).first()

    def _get_category_id_from_source(self, source_category: Optional[str]) -> Optional[int]:
        key = self._normalize_source_category(source_category)
        if not key:
            return None
        mapping = self.db.query(CategoryMapping).filter(CategoryMapping.source_key == key).first()
        return mapping.category_id if mapping else None

    # Admin methods

    def get_all_admin(
        self,
        page: int = 1,
        limit: int = 20,
        enabled: Optional[bool] = None,
        source_website_id: Optional[int] = None,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        category: Optional[str] = None,
        without_category: Optional[bool] = None,
        subcategory: Optional[str] = None,
        is_featured: Optional[bool] = None,
        is_immediate_delivery: Optional[bool] = None,
        price_range: Optional[str] = None,
        in_stock: Optional[bool] = None,
    ) -> Tuple[List[Product], int]:
        """Get all products for admin panel."""
        skip = (page - 1) * limit
        products = self.repo.get_all_admin(
            skip,
            limit,
            enabled,
            source_website_id,
            search,
            category_id,
            category,
            without_category,
            subcategory,
            is_featured,
            is_immediate_delivery,
            price_range,
            in_stock,
        )
        total = self.repo.count_admin(
            enabled,
            source_website_id,
            search,
            category_id,
            category,
            without_category,
            subcategory,
            is_featured,
            is_immediate_delivery,
            price_range,
            in_stock,
        )
        return products, total

    def get_by_id(self, id: int) -> Product:
        """Get product by ID."""
        product = self.repo.get_with_images(id)
        if not product:
            raise NotFoundError("Product", str(id))
        return product

    # Stock methods

    def get_stock_summary(self, product_ids: List[int]) -> dict[int, int]:
        """Get stock quantity summary for a list of products."""
        if not product_ids:
            return {}

        rows = (
            self.db.query(
                StockPurchase.product_id,
                func.coalesce(func.sum(StockPurchase.quantity - StockPurchase.out_quantity), 0).label("stock_qty"),
            )
            .filter(StockPurchase.product_id.in_(product_ids))
            .group_by(StockPurchase.product_id)
            .all()
        )
        return {row.product_id: int(row.stock_qty or 0) for row in rows}

    def get_stock_summary_detailed(self, product_ids: List[int]) -> dict[int, dict]:
        """Get stock, reserved qty, reserved sold value and original price summary for products."""
        if not product_ids:
            return {}

        unique_ids = sorted({int(pid) for pid in product_ids if pid is not None})
        if not unique_ids:
            return {}

        stock_rows = (
            self.db.query(
                StockPurchase.product_id,
                func.coalesce(func.sum(StockPurchase.quantity - StockPurchase.out_quantity), 0).label("stock_qty"),
            )
            .filter(StockPurchase.product_id.in_(unique_ids))
            .group_by(StockPurchase.product_id)
            .all()
        )
        stock_map = {int(row.product_id): int(row.stock_qty or 0) for row in stock_rows}

        reserved_rows = (
            self.db.query(
                SaleItem.product_id,
                func.coalesce(
                    func.sum(func.greatest(SaleItem.quantity - func.coalesce(SaleItem.delivered_quantity, 0), 0)),
                    0,
                ).label("reserved_qty"),
            )
            .filter(
                SaleItem.product_id.in_(unique_ids),
            )
            .group_by(SaleItem.product_id)
            .all()
        )
        reserved_map = {int(row.product_id): int(row.reserved_qty or 0) for row in reserved_rows if row.product_id is not None}

        reserved_sales_rows = (
            self.db.query(
                SaleItem.product_id,
                func.coalesce(
                    func.sum(
                        func.greatest(SaleItem.quantity - func.coalesce(SaleItem.delivered_quantity, 0), 0)
                        * func.coalesce(SaleItem.unit_price, 0)
                    ),
                    0,
                ).label("reserved_sale_value"),
            )
            .filter(
                SaleItem.product_id.in_(unique_ids),
            )
            .group_by(SaleItem.product_id)
            .all()
        )
        reserved_sale_map = {
            int(row.product_id): float(row.reserved_sale_value or 0)
            for row in reserved_sales_rows
            if row.product_id is not None
        }

        price_rows = (
            self.db.query(Product.id, Product.original_price)
            .filter(Product.id.in_(unique_ids))
            .all()
        )
        price_map = {int(row.id): float(row.original_price or 0) for row in price_rows}

        return {
            pid: {
                "stock_qty": stock_map.get(pid, 0),
                "reserved_qty": reserved_map.get(pid, 0),
                "original_price": price_map.get(pid, 0.0),
                "reserved_sale_value": reserved_sale_map.get(pid, 0.0),
            }
            for pid in unique_ids
        }

    def get_stock_purchases(self, product_id: Optional[int] = None, unmatched: Optional[bool] = None) -> List[StockPurchase]:
        """Get stock purchases, optionally filtered by product or unmatched."""
        query = self.db.query(StockPurchase).options(joinedload(StockPurchase.product))
        if product_id is not None:
            query = query.filter(StockPurchase.product_id == product_id)
        if unmatched is True:
            query = query.filter(StockPurchase.product_id.is_(None))
        if unmatched is False:
            query = query.filter(StockPurchase.product_id.isnot(None))
        return query.order_by(StockPurchase.purchase_date.desc(), StockPurchase.id.desc()).all()

    def update_stock_purchase(self, purchase_id: int, product_id: Optional[int]) -> StockPurchase:
        """Associate a stock purchase to a product."""
        purchase = self.db.query(StockPurchase).filter(StockPurchase.id == purchase_id).first()
        if not purchase:
            raise NotFoundError("StockPurchase", str(purchase_id))

        if product_id is not None:
            product = self.db.query(Product).filter(Product.id == product_id).first()
            if not product:
                raise NotFoundError("Product", str(product_id))
        else:
            product = None

        purchase.product_id = product_id
        self.db.commit()
        self.db.refresh(purchase)

        if product_id:
            stock_summary = self.get_stock_summary([product_id])
            if stock_summary.get(product_id, 0) > 0:
                self.db.query(Product).filter(Product.id == product_id).update(
                    {
                        Product.is_immediate_delivery: True,
                        Product.is_check_stock: False,
                    },
                    synchronize_session=False,
                )
                self.db.commit()
            cache.invalidate_all_products()

        return purchase

    def find_duplicate_stock_purchase(
        self,
        purchase_id: int,
        product_id: int,
    ) -> Optional[StockPurchase]:
        """Find duplicate stock purchase for a given product."""
        purchase = self.db.query(StockPurchase).filter(StockPurchase.id == purchase_id).first()
        if not purchase:
            raise NotFoundError("StockPurchase", str(purchase_id))

        return (
            self.db.query(StockPurchase)
            .filter(
                StockPurchase.id != purchase.id,
                StockPurchase.product_id == product_id,
                StockPurchase.purchase_date == purchase.purchase_date,
                StockPurchase.unit_price == purchase.unit_price,
                StockPurchase.quantity == purchase.quantity,
                StockPurchase.total_amount == purchase.total_amount,
            )
            .first()
        )

    def import_stock_csv(self, csv_bytes: bytes) -> dict:
        """Import stock purchases from CSV bytes, creating a Purchase."""
        from app.models.stock import Purchase

        rows = self.preview_stock_csv(csv_bytes)["rows"]
        created = 0
        skipped = 0
        errors: list[str] = []
        touched_products: set[int] = set()
        valid_suppliers = sorted({
            (row.get("supplier") or "").strip()
            for row in rows
            if row["status"] in ("ok", "unmatched", "duplicate") and (row.get("supplier") or "").strip()
        })

        if not valid_suppliers:
            raise ValueError("No se encontró mayorista válido en el CSV.")
        if len(valid_suppliers) > 1:
            raise ValueError(
                "El CSV contiene múltiples mayoristas. Importá un mayorista por archivo. "
                f"Detectados: {', '.join(valid_suppliers)}"
            )
        supplier = valid_suppliers[0]

        # Get common purchase date from first valid row
        purchase_date = None
        for row in rows:
            if row.get("purchase_date"):
                purchase_date = row["purchase_date"]
                break

        if not purchase_date:
            purchase_date = date.today()

        # Create the Purchase first
        purchase = Purchase(
            supplier=supplier,
            purchase_date=purchase_date,
        )
        self.db.add(purchase)
        self.db.flush()  # Get the ID

        for row in rows:
            if row["status"] == "duplicate":
                skipped += 1
                continue
            if row["status"] not in ("ok", "unmatched"):
                errors.append(f"Fila {row['row_number']}: {', '.join(row['errors'])}")
                continue

            item = StockPurchase(
                purchase_id=purchase.id,
                product_id=row["product_id"],
                description=row.get("description") or None,
                code=row.get("code"),
                purchase_date=row["purchase_date"] or purchase_date,
                unit_price=row["unit_price"],
                quantity=row["quantity"],
                total_amount=row["total_amount"],
                out_quantity=0,
            )
            self.db.add(item)
            if row["product_id"]:
                touched_products.add(row["product_id"])
            created += 1

        self.db.commit()

        # Mark immediate delivery for products with stock
        if touched_products:
            stock_summary = self.get_stock_summary(list(touched_products))
            for product_id, stock_qty in stock_summary.items():
                if stock_qty > 0:
                    self.db.query(Product).filter(Product.id == product_id).update(
                        {
                            Product.is_immediate_delivery: True,
                            Product.is_check_stock: False,
                        },
                        synchronize_session=False,
                    )
            self.db.commit()
            cache.invalidate_all_products()

        return {
            "purchase_id": purchase.id,
            "created": created,
            "skipped": skipped,
            "errors": errors,
            "touched_products": len(touched_products),
        }

    def preview_stock_csv(self, csv_bytes: bytes) -> dict:
        """Parse and validate stock CSV without importing."""
        content = csv_bytes.decode("utf-8-sig", errors="ignore")
        if not content.strip():
            raise ValueError("El archivo CSV está vacío.")

        # Detect delimiter
        try:
            dialect = csv.Sniffer().sniff(content[:4096], delimiters=",;|\t")
        except csv.Error:
            dialect = csv.get_dialect("excel")

        reader = csv.DictReader(io.StringIO(content), dialect=dialect)
        if not reader.fieldnames:
            raise ValueError("No se encontraron encabezados en el CSV.")

        def normalize_header(h: str) -> str:
            return re.sub(r"[^a-z0-9_]+", "", (h or "").strip().lower())

        field_map = {normalize_header(h): h for h in reader.fieldnames}

        def get_field(row, *names):
            for name in names:
                key = field_map.get(name)
                if key and key in row:
                    return (row.get(key) or "").strip()
            return ""

        def parse_decimal(value: str) -> Decimal:
            raw = (value or "").strip()
            if not raw:
                return Decimal("0")
            cleaned = re.sub(r"[^\d,\.]", "", raw)
            if "," in cleaned and "." in cleaned:
                if cleaned.rfind(",") > cleaned.rfind("."):
                    cleaned = cleaned.replace(".", "").replace(",", ".")
                else:
                    cleaned = cleaned.replace(",", "")
            elif "," in cleaned and "." not in cleaned:
                cleaned = cleaned.replace(",", ".")
            return Decimal(cleaned)

        def parse_int(value: str) -> int:
            raw = re.sub(r"[^\d]", "", (value or "").strip())
            return int(raw) if raw else 0

        def parse_date(value: str) -> date:
            raw = (value or "").strip()
            for fmt in ("%d/%m/%Y", "%d-%m-%Y"):
                try:
                    return datetime.strptime(raw, fmt).date()
                except ValueError:
                    continue
            raise ValueError("Fecha inválida")

        rows = []
        desc_cache: dict[str, Product | None] = {}

        for idx, row in enumerate(reader, start=2):  # header is line 1
            errors: list[str] = []
            description = get_field(row, "producto", "descripcion", "descripcin", "description")
            code = get_field(row, "codigo", "cdigo", "code")
            supplier = get_field(row, "mayorista", "supplier", "proveedor", "distribuidor")
            derived_code = False
            if not code:
                digits = "".join(re.findall(r"\d", description or ""))
                code = digits[:5] if digits else ""
                derived_code = bool(code)

            product = None

            if not product and description:
                if description in desc_cache:
                    product = desc_cache[description]
                else:
                    matches = (
                        self.db.query(Product)
                        .filter(or_(Product.original_name.ilike(description), Product.custom_name.ilike(description)))
                        .all()
                    )
                    if len(matches) == 1:
                        product = matches[0]
                    elif len(matches) > 1:
                        errors.append("Descripción coincide con múltiples productos")
                    desc_cache[description] = product

            if not product:
                # No error: allow import without product association
                pass

            if not supplier:
                errors.append("Mayorista requerido (columna: mayorista)")

            purchase_date = None
            unit_price = None
            quantity = None
            total_amount = None

            try:
                purchase_date = parse_date(get_field(row, "fecha", "fechacompra", "fechadecompra", "fecha_compra", "purchase_date"))
            except Exception:
                errors.append("Fecha inválida (formato DD/MM/YYYY o DD-MM-YYYY)")

            try:
                unit_price = parse_decimal(get_field(row, "precio", "unit_price", "precio_unitario"))
            except (InvalidOperation, ValueError):
                errors.append("Precio inválido")

            try:
                quantity = parse_int(get_field(row, "cantidad", "qty", "quantity"))
            except ValueError:
                errors.append("Cantidad inválida")

            try:
                total_amount = parse_decimal(get_field(row, "total", "totalcompra", "total_compra", "total_amount"))
            except (InvalidOperation, ValueError):
                errors.append("Total inválido")

            if unit_price is not None and unit_price <= 0:
                errors.append("Precio debe ser mayor a 0")
            if quantity is not None and quantity <= 0:
                errors.append("Cantidad debe ser mayor a 0")

            if total_amount is not None and unit_price is not None and quantity is not None and total_amount <= 0:
                total_amount = (unit_price * Decimal(quantity)).quantize(Decimal("0.01"))

            is_duplicate = False
            if not errors and purchase_date and unit_price is not None and quantity is not None and total_amount is not None:
                if product:
                    exists = (
                        self.db.query(StockPurchase)
                        .filter(
                            StockPurchase.product_id == product.id,
                            StockPurchase.purchase_date == purchase_date,
                            StockPurchase.unit_price == unit_price,
                            StockPurchase.quantity == quantity,
                            StockPurchase.total_amount == total_amount,
                        )
                        .first()
                    )
                else:
                    exists = (
                        self.db.query(StockPurchase)
                        .filter(
                            StockPurchase.product_id.is_(None),
                            StockPurchase.description == (description or None),
                            StockPurchase.code == (code or None),
                            StockPurchase.purchase_date == purchase_date,
                            StockPurchase.unit_price == unit_price,
                            StockPurchase.quantity == quantity,
                            StockPurchase.total_amount == total_amount,
                        )
                        .first()
                    )
                if exists:
                    is_duplicate = True

            status = "ok"
            if errors:
                status = "error"
            elif is_duplicate:
                status = "duplicate"
            elif not product:
                status = "unmatched"

            rows.append({
                "row_number": idx,
                "description": description or None,
                "code": code or None,
                "supplier": supplier or None,
                "derived_code": derived_code,
                "purchase_date": purchase_date,
                "unit_price": unit_price,
                "quantity": quantity,
                "total_amount": total_amount,
                "product_id": product.id if product else None,
                "product_name": product.display_name if product else None,
                "status": status,
                "errors": errors,
            })

        summary = {
            "total": len(rows),
            "ok": sum(1 for r in rows if r["status"] == "ok"),
            "duplicate": sum(1 for r in rows if r["status"] == "duplicate"),
            "error": sum(1 for r in rows if r["status"] == "error"),
            "unmatched": sum(1 for r in rows if r["status"] == "unmatched"),
        }

        return {"rows": rows, "summary": summary}

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

        target_category = self._get_category_by_name(data.category) if data.category else None
        if data.category and target_category is None:
            from app.core.exceptions import ValidationError
            raise ValidationError(f"Categoría no encontrada: {data.category}")

        # Create product
        if data.category and target_category is None:
            from app.core.exceptions import ValidationError
            raise ValidationError(f"Categoría no encontrada: {data.category}")

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
            min_purchase_qty=scraped.min_purchase_qty,
            kit_content=scraped.kit_content,
            enabled=data.enabled,
            is_featured=True,  # Mark new scraped products as "Nuevo"
            markup_percentage=data.markup_percentage,
            source_category=scraped.categories[0] if scraped.categories else None,
            category=scraped.categories[0] if scraped.categories else None,
            category_id=(
                target_category.id
                if target_category
                else self._get_category_id_from_source(scraped.categories[0] if scraped.categories else None)
            ),
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
            has_original_price = product.original_price is not None and float(product.original_price) > 0

            if not has_custom_price and not has_markup and not has_original_price:
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
        if data.is_best_seller is not None:
            product.is_best_seller = data.is_best_seller
        if data.markup_percentage is not None:
            product.markup_percentage = data.markup_percentage
        if data.custom_name is not None:
            product.custom_name = data.custom_name if data.custom_name else None
        if data.original_price is not None:
            product.original_price = data.original_price if data.original_price > 0 else None
        if data.custom_price is not None:
            product.custom_price = data.custom_price if data.custom_price > 0 else None
        if data.display_order is not None:
            product.display_order = data.display_order
        if data.category is not None:
            old_category_id = product.category_id
            target_category = self._get_category_by_name(data.category) if data.category else None
            if data.category and target_category is None:
                from app.core.exceptions import ValidationError
                raise ValidationError(f"Categoría no encontrada: {data.category}")
            product.category_id = target_category.id if target_category else None
            # Clear subcategory when category changed
            if old_category_id != product.category_id:
                product.subcategory = None
        if data.subcategory is not None:
            product.subcategory = data.subcategory if data.subcategory else None
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
            if scraped.price is not None:
                new_price = Decimal(str(scraped.price))
                if product.original_price is None:
                    product.original_price = new_price
                    product.pending_original_price = None
                    product.pending_price_detected_at = None
                elif Decimal(str(product.original_price)) != new_price:
                    product.pending_original_price = new_price
                    product.pending_price_detected_at = datetime.utcnow()
                else:
                    product.pending_original_price = None
                    product.pending_price_detected_at = None
            product.description = scraped.description
            product.short_description = scraped.short_description
            product.brand = scraped.brand or product.brand
            product.sku = scraped.sku or product.sku
            product.min_purchase_qty = scraped.min_purchase_qty or product.min_purchase_qty
            product.kit_content = scraped.kit_content or product.kit_content
            if scraped.categories:
                product.source_category = scraped.categories[0]
                if product.category_id is None:
                    product.category_id = self._get_category_id_from_source(scraped.categories[0])
                # Keep legacy text column aligned with source
                product.category = scraped.categories[0]
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

        target_category = self._get_category_by_name(data.category) if data.category else None
        if data.category and target_category is None:
            from app.core.exceptions import ValidationError
            raise ValidationError(f"Categoria no encontrada: {data.category}")

        # Create product
        original_price = None
        custom_price = data.price
        if data.price_as_original:
            original_price = data.price
            custom_price = None

        product = Product(
            source_website_id=manual_source.id,
            slug=slug,
            source_url=None,
            original_name=data.name,
            original_price=original_price,
            custom_price=custom_price,
            description=data.description,
            short_description=data.short_description,
            brand=data.brand,
            sku=data.sku,
            enabled=data.enabled,
            is_featured=data.is_featured,
            is_immediate_delivery=data.is_immediate_delivery,
            markup_percentage=Decimal("0"),
            category_id=target_category.id if target_category else None,
            source_category=None,
            category=data.category,
            subcategory=data.subcategory,
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

    def bulk_set_wholesale_markup(
        self,
        markup_percentage: Decimal,
        only_enabled: bool = True,
        source_website_id: Optional[int] = None
    ) -> int:
        """Set wholesale markup percentage for multiple products."""
        query = self.db.query(Product)
        if only_enabled:
            query = query.filter(Product.enabled == True)
        if source_website_id:
            query = query.filter(Product.source_website_id == source_website_id)

        count = query.update(
            {Product.wholesale_markup_percentage: markup_percentage},
            synchronize_session=False
        )
        self.db.commit()
        cache.invalidate_all_products()
        return count

    def get_products_by_ids(self, product_ids: List[int]) -> List[Product]:
        """Get products by ids (no filter)."""
        if not product_ids:
            return []
        return self.db.query(Product).filter(Product.id.in_(product_ids)).all()

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
        category: Optional[str] = None,
        subcategory: Optional[str] = None
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
            cat = self._get_category_by_name(category)
            if cat is None:
                from app.core.exceptions import ValidationError
                raise ValidationError(f"Categoría no encontrada: {category}")
            update_data[Product.category_id] = cat.id if cat else None
        if subcategory:
            update_data[Product.subcategory] = subcategory

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
        logger.info(f"Activated {count} products (skipped {skipped} without valid price), markup: {markup_percentage}%, category: {category}, subcategory: {subcategory}")
        return {"activated": count, "skipped": skipped}

    def change_category_selected(self, product_ids: List[int], category: str) -> int:
        """
        Change category for selected products.
        Also clears subcategory since it no longer applies.

        Returns the number of products updated.
        """
        cat = self._get_category_by_name(category)
        if cat is None:
            from app.core.exceptions import ValidationError
            raise ValidationError(f"Categoría no encontrada: {category}")
        count = self.db.query(Product).filter(
            Product.id.in_(product_ids)
        ).update(
            {Product.category_id: (cat.id if cat else None), Product.subcategory: None},
            synchronize_session=False
        )
        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Changed category to '{category}' for {count} products")
        return count

    def change_subcategory_selected(self, product_ids: List[int], subcategory: str) -> int:
        """
        Change subcategory for selected products.

        Returns the number of products updated.
        """
        count = self.db.query(Product).filter(
            Product.id.in_(product_ids)
        ).update(
            {Product.subcategory: subcategory},
            synchronize_session=False
        )
        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Changed subcategory to '{subcategory}' for {count} products")
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
            .join(Product, Product.category_id == CategoryModel.id)
            .filter(CategoryModel.is_active == True)
            .filter(Product.enabled == True)
            .distinct()
            .order_by(CategoryModel.display_order, CategoryModel.name)
            .all()
        )

        return [
            {
                "name": cat.name,
                "color": cat.color or "#6b7280",
                "show_in_menu": cat.show_in_menu or False,
                "display_order": cat.display_order,
            }
            for cat in categories
        ]

    def get_public_subcategories(self, category: Optional[str] = None) -> List[dict]:
        """Get list of subcategories with their properties for public display."""
        from app.models.subcategory import Subcategory as SubcategoryModel
        from app.models.category import Category as CategoryModel

        query = (
            self.db.query(SubcategoryModel)
            .join(CategoryModel, SubcategoryModel.category_id == CategoryModel.id)
            .filter(SubcategoryModel.is_active == True)
            .filter(CategoryModel.is_active == True)
        )

        if category:
            query = query.filter(CategoryModel.name == category)

        subcategories = query.order_by(SubcategoryModel.display_order, SubcategoryModel.name).all()

        result = []
        for sub in subcategories:
            cat = self.db.query(CategoryModel).filter(CategoryModel.id == sub.category_id).first()
            # Only include subcategories that have enabled products
            if not cat:
                continue
            product_count = self.db.query(Product).filter(
                Product.category_id == cat.id,
                Product.subcategory == sub.name,
                Product.enabled == True
            ).count()
            if product_count > 0:
                result.append({
                    "name": sub.name,
                    "category_name": cat.name if cat else None,
                    "color": sub.color or "#6b7280",
                })

        return result

    def get_enabled_products(self) -> List[Product]:
        """Get all enabled products with images for PDF export."""
        return self.db.query(Product).filter(
            Product.enabled == True
        ).order_by(Product.category_id, Product.original_name).all()

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
                        min_purchase_qty=scraped.min_purchase_qty,
                        kit_content=scraped.kit_content,
                        enabled=False,  # Disabled by default - admin enables manually
                        is_featured=True,  # Mark new scraped products as "Nuevo"
                        markup_percentage=Decimal("0"),
                        source_category=scraped.categories[0] if scraped.categories else None,
                        category=scraped.categories[0] if scraped.categories else None,
                        category_id=self._get_category_id_from_source(scraped.categories[0] if scraped.categories else None),
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
                Category.name.label("category_name"),
                func.count(Product.id).label('total'),
                func.sum(case((Product.enabled == True, 1), else_=0)).label('enabled')
            )
            .outerjoin(Category, Product.category_id == Category.id)
            .group_by(Product.source_website_id, Category.name)
            .all()
        )

        # Build stats list
        stats = []
        categories_set = set()

        for row in stats_query:
            source_id = row.source_website_id
            category = row.category_name or "Sin categoría"
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

    def get_stats_by_price_range(self) -> dict:
        """
        Get product stats grouped by price ranges.

        Ranges:
        - 0 to 5000
        - 5001 to 20000
        - 20001 to 80000
        - greater than 80000

        Returns:
            dict with ranges containing count and products list
        """
        from sqlalchemy import func, case, and_

        # Define price ranges
        ranges = [
            {"key": "0-5000", "label": "$0 - $5.000", "min": 0, "max": 5000},
            {"key": "5001-20000", "label": "$5.001 - $20.000", "min": 5001, "max": 20000},
            {"key": "20001-80000", "label": "$20.001 - $80.000", "min": 20001, "max": 80000},
            {"key": "80001+", "label": "Mayor a $80.000", "min": 80001, "max": None},
        ]

        result = []

        for price_range in ranges:
            # Build query conditions
            conditions = [Product.enabled == True]

            if price_range["max"] is not None:
                conditions.append(Product.original_price >= price_range["min"])
                conditions.append(Product.original_price <= price_range["max"])
            else:
                conditions.append(Product.original_price > price_range["min"])

            # Get products in this range
            products = (
                self.db.query(Product)
                .filter(and_(*conditions))
                .order_by(Product.original_price.asc())
                .limit(50)  # Limit to 50 products per range for performance
                .all()
            )

            # Get total count
            total_count = (
                self.db.query(func.count(Product.id))
                .filter(and_(*conditions))
                .scalar()
            )

            # Build products list with essential info
            products_list = []
            for p in products:
                # Get first image
                first_image = None
                if p.images:
                    first_image = p.images[0].url if p.images[0].url else p.images[0].original_url

                products_list.append({
                    "id": p.id,
                    "name": p.custom_name or p.original_name,
                    "original_name": p.original_name,
                    "price": float(p.original_price) if p.original_price else None,
                    "sku": p.sku,
                    "source_name": p.source_website.display_name if p.source_website else None,
                    "image": first_image,
                })

            result.append({
                "key": price_range["key"],
                "label": price_range["label"],
                "min": price_range["min"],
                "max": price_range["max"],
                "count": total_count or 0,
                "products": products_list,
            })

        return {"ranges": result}

    def get_stock_stats_by_category(self) -> dict:
        """
        Get stock quantity and valuation by category.
        Valuation uses original_price.
        """
        rows = (
            self.db.query(
                Category.name.label("category_name"),
                func.coalesce(func.sum(StockPurchase.quantity - StockPurchase.out_quantity), 0).label("stock_qty"),
                func.coalesce(
                    func.sum(
                        (StockPurchase.quantity - StockPurchase.out_quantity) * func.coalesce(Product.original_price, 0)
                    ),
                    0
                ).label("stock_value"),
            )
            .join(StockPurchase, StockPurchase.product_id == Product.id)
            .outerjoin(Category, Product.category_id == Category.id)
            .group_by(Category.name)
            .all()
        )

        items = []
        total_qty = 0
        total_value = 0
        for row in rows:
            category = row.category_name or "Sin categoría"
            qty = int(row.stock_qty or 0)
            value = float(row.stock_value or 0)
            total_qty += qty
            total_value += value
            items.append({
                "category": category,
                "stock_qty": qty,
                "stock_value": value,
            })

        items.sort(key=lambda x: x["stock_qty"], reverse=True)

        return {
            "total_qty": total_qty,
            "total_value": total_value,
            "items": items,
        }

    def get_pending_price_changes(self) -> dict:
        """Get products with pending original price changes."""
        products = (
            self.db.query(Product)
            .filter(Product.pending_original_price.isnot(None))
            .order_by(Product.pending_price_detected_at.desc().nullslast(), Product.id.desc())
            .all()
        )

        items = []
        for product in products:
            items.append({
                "product_id": product.id,
                "display_name": product.display_name,
                "source_website_name": product.source_website.display_name if product.source_website else None,
                "original_price": float(product.original_price) if product.original_price is not None else None,
                "pending_original_price": float(product.pending_original_price) if product.pending_original_price is not None else None,
                "detected_at": product.pending_price_detected_at,
            })

        return {"items": items}

    def approve_pending_prices(self, product_ids: List[int]) -> int:
        """Approve pending original price changes."""
        products = (
            self.db.query(Product)
            .filter(Product.id.in_(product_ids))
            .all()
        )
        updated = 0
        for product in products:
            if product.pending_original_price is None:
                continue
            product.original_price = product.pending_original_price
            product.pending_original_price = None
            product.pending_price_detected_at = None
            updated += 1

        if updated:
            self.db.commit()
            cache.invalidate_all_products()

        return updated

    def reject_pending_prices(self, product_ids: List[int]) -> int:
        """Reject pending original price changes."""
        products = (
            self.db.query(Product)
            .filter(Product.id.in_(product_ids))
            .all()
        )
        updated = 0
        for product in products:
            if product.pending_original_price is None:
                continue
            product.pending_original_price = None
            product.pending_price_detected_at = None
            updated += 1

        if updated:
            self.db.commit()
            cache.invalidate_all_products()

        return updated

    def get_financial_stats(self) -> dict:
        """Get dashboard financial stats."""
        total_purchased = (
            self.db.query(func.coalesce(func.sum(StockPurchase.total_amount), 0))
            .scalar()
        )

        total_collected = (
            self.db.query(func.coalesce(func.sum(Sale.paid_amount), 0))
            .scalar()
        )

        total_pending_delivery = (
            self.db.query(
                func.coalesce(
                    func.sum(func.greatest(Sale.total_amount - func.coalesce(Sale.delivered_amount, 0), 0)),
                    0,
                )
            )
            .scalar()
        )

        total_pending_payment = (
            self.db.query(
                func.coalesce(
                    func.sum(
                        func.greatest(
                            func.coalesce(Sale.delivered_amount, 0) - func.coalesce(Sale.paid_amount, 0),
                            0,
                        )
                    ),
                    0,
                )
            )
            .scalar()
        )

        # Keep dashboard "Stock a costo" aligned with stock view card "$ STOCK":
        # value = sum(max(stock_qty - reserved_qty, 0) * original_price)
        product_ids_with_stock = [
            int(pid)
            for (pid,) in (
                self.db.query(StockPurchase.product_id)
                .filter(StockPurchase.product_id.isnot(None))
                .distinct()
                .all()
            )
            if pid is not None
        ]
        stock_summary = self.get_stock_summary_detailed(product_ids_with_stock)
        stock_value_available = float(
            sum(
                max(int(values["stock_qty"]) - int(values["reserved_qty"]), 0)
                * float(values["original_price"] or 0)
                for values in stock_summary.values()
            )
        )

        # Stats by seller
        sellers = ["Facu", "Heber"]
        by_seller = {}
        for seller in sellers:
            collected = (
                self.db.query(func.coalesce(func.sum(Sale.paid_amount), 0))
                .filter(Sale.seller == seller)
                .scalar()
            )
            pending_delivery = (
                self.db.query(
                    func.coalesce(
                        func.sum(func.greatest(Sale.total_amount - func.coalesce(Sale.delivered_amount, 0), 0)),
                        0,
                    )
                )
                .filter(Sale.seller == seller)
                .scalar()
            )
            pending_payment = (
                self.db.query(
                    func.coalesce(
                        func.sum(
                            func.greatest(
                                func.coalesce(Sale.delivered_amount, 0) - func.coalesce(Sale.paid_amount, 0),
                                0,
                            )
                        ),
                        0,
                    )
                )
                .filter(Sale.seller == seller)
                .scalar()
            )
            by_seller[seller] = {
                "collected": float(collected or 0),
                "pending_delivery": float(pending_delivery or 0),
                "pending_payment": float(pending_payment or 0),
            }

        return {
            "total_purchased": float(total_purchased or 0),
            "total_collected": float(total_collected or 0),
            "total_pending_delivery": float(total_pending_delivery or 0),
            "total_pending_payment": float(total_pending_payment or 0),
            "stock_value_cost": stock_value_available,
            "by_seller": by_seller,
        }

    def get_public_analytics_summary(self, days: int = 7) -> dict:
        """Get summary metrics from public analytics events."""
        safe_days = max(1, min(days, 90))
        since = datetime.utcnow() - timedelta(days=safe_days)

        base_query = self.db.query(AnalyticsEvent).filter(AnalyticsEvent.created_at >= since)

        event_rows = (
            self.db.query(
                AnalyticsEvent.event_name,
                func.count(AnalyticsEvent.id).label("count"),
            )
            .filter(AnalyticsEvent.created_at >= since)
            .group_by(AnalyticsEvent.event_name)
            .all()
        )

        event_counts = {row.event_name: int(row.count or 0) for row in event_rows}

        sessions_count = int(
            base_query.with_entities(func.count(func.distinct(AnalyticsEvent.session_id))).scalar() or 0
        )

        page_views = event_counts.get("page_view", 0)
        searches = event_counts.get("search", 0)
        product_clicks = event_counts.get("product_click", 0)
        whatsapp_clicks = event_counts.get("whatsapp_click", 0)

        top_search_rows = (
            self.db.query(
                func.lower(func.trim(AnalyticsEvent.search_query)).label("query"),
                func.count(AnalyticsEvent.id).label("count"),
            )
            .filter(
                AnalyticsEvent.created_at >= since,
                AnalyticsEvent.event_name == "search",
                AnalyticsEvent.search_query.isnot(None),
                func.length(func.trim(AnalyticsEvent.search_query)) > 0,
            )
            .group_by(func.lower(func.trim(AnalyticsEvent.search_query)))
            .order_by(func.count(AnalyticsEvent.id).desc())
            .limit(10)
            .all()
        )

        top_category_rows = (
            self.db.query(
                AnalyticsEvent.category,
                func.count(AnalyticsEvent.id).label("count"),
            )
            .filter(
                AnalyticsEvent.created_at >= since,
                AnalyticsEvent.event_name == "category_click",
                AnalyticsEvent.category.isnot(None),
            )
            .group_by(AnalyticsEvent.category)
            .order_by(func.count(AnalyticsEvent.id).desc())
            .limit(10)
            .all()
        )

        top_product_rows = (
            self.db.query(
                AnalyticsEvent.product_slug,
                func.max(AnalyticsEvent.product_id).label("product_id"),
                func.count(AnalyticsEvent.id).label("count"),
            )
            .filter(
                AnalyticsEvent.created_at >= since,
                AnalyticsEvent.event_name == "product_click",
                AnalyticsEvent.product_slug.isnot(None),
            )
            .group_by(AnalyticsEvent.product_slug)
            .order_by(func.count(AnalyticsEvent.id).desc())
            .limit(10)
            .all()
        )
        top_product_slugs = [row.product_slug for row in top_product_rows if row.product_slug]
        product_name_map: dict[str, str] = {}
        if top_product_slugs:
            products = (
                self.db.query(Product.slug, Product.custom_name, Product.original_name)
                .filter(Product.slug.in_(top_product_slugs))
                .all()
            )
            product_name_map = {
                row.slug: (row.custom_name or row.original_name or row.slug)
                for row in products
            }

        daily_rows = (
            self.db.query(
                func.date(AnalyticsEvent.created_at).label("day"),
                func.sum(case((AnalyticsEvent.event_name == "page_view", 1), else_=0)).label("page_views"),
                func.sum(case((AnalyticsEvent.event_name == "search", 1), else_=0)).label("searches"),
                func.sum(case((AnalyticsEvent.event_name == "product_click", 1), else_=0)).label("product_clicks"),
                func.sum(case((AnalyticsEvent.event_name == "whatsapp_click", 1), else_=0)).label("whatsapp_clicks"),
            )
            .filter(AnalyticsEvent.created_at >= since)
            .group_by(func.date(AnalyticsEvent.created_at))
            .order_by(func.date(AnalyticsEvent.created_at).asc())
            .all()
        )

        return {
            "window_days": safe_days,
            "from_date": since.date().isoformat(),
            "totals": {
                "sessions": sessions_count,
                "page_views": page_views,
                "searches": searches,
                "product_clicks": product_clicks,
                "whatsapp_clicks": whatsapp_clicks,
                "product_ctr": round((product_clicks / page_views) * 100, 2) if page_views else 0.0,
                "whatsapp_from_product_ctr": round((whatsapp_clicks / product_clicks) * 100, 2) if product_clicks else 0.0,
            },
            "top_searches": [
                {"query": row.query, "count": int(row.count or 0)}
                for row in top_search_rows
            ],
            "top_categories": [
                {"category": row.category, "count": int(row.count or 0)}
                for row in top_category_rows
            ],
            "top_products": [
                {
                    "product_id": int(row.product_id) if row.product_id is not None else None,
                    "product_slug": row.product_slug,
                    "product_name": product_name_map.get(row.product_slug, row.product_slug),
                    "count": int(row.count or 0),
                }
                for row in top_product_rows
            ],
            "daily": [
                {
                    "date": row.day.isoformat() if row.day else None,
                    "page_views": int(row.page_views or 0),
                    "searches": int(row.searches or 0),
                    "product_clicks": int(row.product_clicks or 0),
                    "whatsapp_clicks": int(row.whatsapp_clicks or 0),
                }
                for row in daily_rows
            ],
        }

    def mark_new_by_scrape_date(self, scrape_date: str) -> int:
        """Mark products scraped on a specific date as 'Nuevo' (is_featured=true)."""
        from sqlalchemy import cast, Date

        count = (
            self.db.query(Product)
            .filter(cast(Product.last_scraped_at, Date) == scrape_date)
            .update({Product.is_featured: True}, synchronize_session=False)
        )
        self.db.commit()
        cache.invalidate_all_products()
        return count

    def bulk_remove_badge(
        self,
        product_ids: Optional[List[int]] = None,
        badge_field: str = "is_featured"
    ) -> int:
        """
        Remove badge from selected products or all enabled products.

        Args:
            product_ids: List of product IDs. If None, applies to all enabled products.
            badge_field: Which badge to remove (is_featured, is_immediate_delivery, is_best_seller)

        Returns:
            Number of products updated
        """
        valid_badges = ["is_featured", "is_immediate_delivery", "is_best_seller"]
        if badge_field not in valid_badges:
            raise ValueError(f"Invalid badge field. Must be one of: {valid_badges}")

        query = self.db.query(Product)

        if product_ids:
            query = query.filter(Product.id.in_(product_ids))
        else:
            # Apply to all enabled products
            query = query.filter(Product.enabled == True)

        count = query.update(
            {getattr(Product, badge_field): False},
            synchronize_session=False
        )

        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Removed {badge_field} from {count} products")

        return count

    def calculate_best_sellers(self, threshold: int = 5) -> int:
        """
        Automatically mark products as best sellers based on sales quantity.

        Args:
            threshold: Minimum quantity sold to be considered best seller

        Returns:
            Number of products marked as best sellers
        """
        from app.models.sale import SaleItem

        # Get top selling products
        top_sellers = (
            self.db.query(
                SaleItem.product_id,
                func.sum(SaleItem.quantity).label('total_sold')
            )
            .group_by(SaleItem.product_id)
            .having(func.sum(SaleItem.quantity) >= threshold)
            .all()
        )

        product_ids = [row.product_id for row in top_sellers]

        if not product_ids:
            return 0

        # Mark as best sellers
        count = self.db.query(Product).filter(
            Product.id.in_(product_ids)
        ).update(
            {Product.is_best_seller: True},
            synchronize_session=False
        )

        self.db.commit()
        cache.invalidate_all_products()
        logger.info(f"Marked {count} products as best sellers (threshold: {threshold})")

        return count

    # ==========================================
    # Purchase & Payment Methods
    # ==========================================

    def get_purchases(
        self,
        page: int = 1,
        limit: int = 50,
        supplier: Optional[str] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        product_id: Optional[int] = None,
    ) -> Tuple[list, int]:
        """Get all purchases with filters and pagination."""
        from app.models.stock import Purchase

        query = self.db.query(Purchase)

        if supplier:
            query = query.filter(Purchase.supplier.ilike(f"%{supplier}%"))

        if date_from:
            query = query.filter(Purchase.purchase_date >= date_from)

        if date_to:
            query = query.filter(Purchase.purchase_date <= date_to)

        if product_id:
            # Filter purchases that contain this product
            query = query.filter(
                Purchase.id.in_(
                    self.db.query(StockPurchase.purchase_id)
                    .filter(StockPurchase.product_id == product_id)
                    .distinct()
                )
            )

        total = query.count()

        purchases = (
            query
            .order_by(Purchase.purchase_date.desc(), Purchase.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        return purchases, total

    def get_purchase_detail(self, purchase_id: int):
        """Get a purchase with items and payments."""
        from app.models.stock import Purchase

        purchase = (
            self.db.query(Purchase)
            .filter(Purchase.id == purchase_id)
            .first()
        )
        if not purchase:
            raise NotFoundError("Purchase", str(purchase_id))
        return purchase

    def add_payment_to_purchase(self, purchase_id: int, payer: str, amount: Decimal, payment_method: str):
        """Add a payment to a purchase."""
        from app.models.stock import Purchase, PurchasePayment

        purchase = self.db.query(Purchase).filter(Purchase.id == purchase_id).first()
        if not purchase:
            raise NotFoundError("Purchase", str(purchase_id))

        payment = PurchasePayment(
            purchase_id=purchase_id,
            payer=payer,
            amount=amount,
            payment_method=payment_method,
        )
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(purchase)
        return purchase

    def delete_payment(self, payment_id: int) -> None:
        """Delete a payment from a purchase."""
        from app.models.stock import PurchasePayment

        payment = self.db.query(PurchasePayment).filter(PurchasePayment.id == payment_id).first()
        if not payment:
            raise NotFoundError("PurchasePayment", str(payment_id))

        self.db.delete(payment)
        self.db.commit()

    def get_purchases_by_payer(self) -> dict:
        """Get total purchases grouped by payer for dashboard."""
        from app.models.stock import Purchase, PurchasePayment

        # Total of all purchases
        total_purchases = (
            self.db.query(func.coalesce(func.sum(StockPurchase.total_amount), 0))
            .scalar()
        )

        # Total paid
        total_paid = (
            self.db.query(func.coalesce(func.sum(PurchasePayment.amount), 0))
            .scalar()
        )

        # Total by payer
        by_payer = (
            self.db.query(
                PurchasePayment.payer,
                func.sum(PurchasePayment.amount).label("total_amount"),
                func.count(PurchasePayment.id).label("payment_count"),
            )
            .group_by(PurchasePayment.payer)
            .all()
        )

        result = {
            "by_payer": [
                {
                    "payer": row.payer,
                    "total_amount": float(row.total_amount or 0),
                    "payment_count": row.payment_count,
                }
                for row in by_payer
            ],
            "without_payment": float(total_purchases or 0) - float(total_paid or 0),
        }

        return result

    def get_suppliers(self) -> List[str]:
        """Get unique list of suppliers."""
        from app.models.stock import Purchase

        suppliers = (
            self.db.query(Purchase.supplier)
            .distinct()
            .order_by(Purchase.supplier)
            .all()
        )
        return [s[0] for s in suppliers]

