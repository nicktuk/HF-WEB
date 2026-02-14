"""Service for Sales operations."""
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.models.stock import StockPurchase
from sqlalchemy import or_
from app.core.exceptions import NotFoundError, ValidationError


class SalesService:
    def __init__(self, db: Session):
        self.db = db

    def _get_available_stock(self, product_id: int) -> int:
        qty = (
            self.db.query(
                func.coalesce(func.sum(StockPurchase.quantity - StockPurchase.out_quantity), 0)
            )
            .filter(StockPurchase.product_id == product_id)
            .scalar()
        )
        return int(qty or 0)

    def _deduct_stock(self, product_id: int, quantity: int) -> None:
        """Deduct stock from purchases (FIFO)."""
        if quantity <= 0:
            return

        available = self._get_available_stock(product_id)
        if available < quantity:
            raise ValidationError(f"Stock insuficiente para producto {product_id}. Disponible: {available}")

        remaining = quantity
        purchases = (
            self.db.query(StockPurchase)
            .filter(StockPurchase.product_id == product_id)
            .order_by(StockPurchase.purchase_date.asc(), StockPurchase.id.asc())
            .all()
        )

        for purchase in purchases:
            if remaining <= 0:
                break
            available_in_purchase = purchase.quantity - purchase.out_quantity
            if available_in_purchase <= 0:
                continue
            deduct = min(available_in_purchase, remaining)
            purchase.out_quantity += deduct
            remaining -= deduct

        if remaining > 0:
            raise ValidationError("No se pudo descontar el stock completo")

    def _restore_stock(self, product_id: int, quantity: int) -> None:
        """Restore stock to purchases by decreasing out_quantity (LIFO)."""
        if quantity <= 0:
            return

        remaining = quantity
        purchases = (
            self.db.query(StockPurchase)
            .filter(StockPurchase.product_id == product_id)
            .order_by(StockPurchase.purchase_date.desc(), StockPurchase.id.desc())
            .all()
        )

        for purchase in purchases:
            if remaining <= 0:
                break
            if purchase.out_quantity <= 0:
                continue
            restore = min(purchase.out_quantity, remaining)
            purchase.out_quantity -= restore
            remaining -= restore

        if remaining > 0:
            raise ValidationError("No se pudo revertir el stock completo")

    def _normalize_items(
        self,
        raw_items,
        force_delivered: bool | None = None,
        force_paid: bool | None = None,
    ) -> tuple[list[dict], Decimal]:
        if not raw_items:
            raise ValidationError("La venta debe tener items")

        items: list[dict] = []
        total_amount = Decimal("0")
        seen_products: set[int] = set()
        for item in raw_items:
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                raise NotFoundError("Product", str(item.product_id))
            if product.id in seen_products:
                raise ValidationError("No se permite repetir el mismo producto en la venta")
            seen_products.add(product.id)

            qty = int(item.quantity)
            if qty <= 0:
                raise ValidationError("La cantidad debe ser mayor a 0")
            unit_price = Decimal(str(item.unit_price))
            if unit_price <= 0:
                raise ValidationError("El precio unitario debe ser mayor a 0")
            total_price = (unit_price * Decimal(qty)).quantize(Decimal("0.01"))
            delivered_flag_raw = getattr(item, "delivered", None)
            paid_flag_raw = getattr(item, "paid", None)
            delivered_qty_raw = item.delivered_quantity if getattr(item, "delivered_quantity", None) is not None else None

            if force_delivered is not None:
                delivered_flag = bool(force_delivered)
            elif delivered_flag_raw is not None:
                delivered_flag = bool(delivered_flag_raw)
            elif delivered_qty_raw is not None:
                delivered_flag = int(delivered_qty_raw or 0) > 0
            else:
                delivered_flag = False

            if force_paid is not None:
                paid_flag = bool(force_paid)
            elif paid_flag_raw is not None:
                paid_flag = bool(paid_flag_raw)
            else:
                paid_flag = False

            delivered_qty = qty if delivered_flag else 0

            items.append({
                "product_id": product.id,
                "quantity": qty,
                "delivered_quantity": delivered_qty,
                "is_paid": paid_flag,
                "unit_price": unit_price,
                "total_price": total_price,
            })
            total_amount += total_price

        return items, total_amount.quantize(Decimal("0.01"))

    def _sync_sale_state(self, sale: Sale) -> None:
        delivered_amount = Decimal("0.00")
        paid_amount = Decimal("0.00")
        delivered_all = True
        paid_all = True
        has_items = False

        for item in sale.items:
            has_items = True
            qty = int(item.quantity or 0)
            delivered_full = qty > 0 and int(item.delivered_quantity or 0) >= qty
            if not delivered_full:
                delivered_all = False
            if not item.is_paid:
                paid_all = False
            line_total = Decimal(str(item.total_price or 0)).quantize(Decimal("0.01"))
            if delivered_full:
                delivered_amount += line_total
            if item.is_paid:
                paid_amount += line_total

        sale.delivered_amount = delivered_amount.quantize(Decimal("0.01"))
        sale.paid_amount = paid_amount.quantize(Decimal("0.01"))
        sale.delivered = has_items and delivered_all
        sale.paid = has_items and paid_all

    def _apply_item_states(
        self,
        sale: Sale,
        delivery_targets_by_product: dict[int, bool] | None = None,
        paid_targets_by_product: dict[int, bool] | None = None,
    ) -> None:
        for item in sale.items:
            current_qty = int(item.delivered_quantity or 0)
            qty = int(item.quantity or 0)
            current_delivered = qty > 0 and current_qty >= qty
            target_delivered = delivery_targets_by_product.get(item.product_id, current_delivered) if delivery_targets_by_product is not None else current_delivered
            target_qty = qty if target_delivered else 0
            delta = target_qty - current_qty
            if delta > 0:
                self._deduct_stock(item.product_id, delta)
            elif delta < 0:
                self._restore_stock(item.product_id, -delta)
            item.delivered_quantity = target_qty

            if paid_targets_by_product is not None:
                item.is_paid = bool(paid_targets_by_product.get(item.product_id, item.is_paid))

        self._sync_sale_state(sale)

    def create_sale(self, data) -> Sale:
        items, total_amount = self._normalize_items(
            data.items,
            force_delivered=True if data.delivered else None,
            force_paid=True if data.paid else None,
        )

        # Create sale
        sale = Sale(
            customer_name=data.customer_name,
            notes=data.notes,
            installments=data.installments,
            seller=data.seller,
            delivered=data.delivered,
            paid=data.paid,
            total_amount=total_amount,
            delivered_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
        )
        self.db.add(sale)
        self.db.flush()

        # Create items
        for item in items:
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item["product_id"],
                quantity=item["quantity"],
                delivered_quantity=0,
                is_paid=False,
                unit_price=item["unit_price"],
                total_price=item["total_price"],
            )
            self.db.add(sale_item)

        self.db.flush()
        self._apply_item_states(
            sale,
            {item["product_id"]: item["delivered_quantity"] > 0 for item in items},
            {item["product_id"]: item["is_paid"] for item in items},
        )

        self.db.commit()
        self.db.refresh(sale)
        return sale

    def list_sales(self, limit: int = 50, search: str | None = None) -> list[Sale]:
        query = self.db.query(Sale)

        if search:
            search_term = f"%{search}%"
            # Search by customer_name or product name in items
            query = query.outerjoin(SaleItem).outerjoin(Product).filter(
                or_(
                    Sale.customer_name.ilike(search_term),
                    Product.custom_name.ilike(search_term),
                    Product.original_name.ilike(search_term),
                )
            ).distinct()

        return query.order_by(Sale.created_at.desc()).limit(limit).all()

    def update_sale(
        self,
        sale_id: int,
        delivered: bool | None,
        paid: bool | None,
        customer_name: str | None = None,
        notes: str | None = None,
        installments: int | None = None,
        seller: str | None = None,
        items: list | None = None,
    ) -> Sale:
        sale = self.db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise NotFoundError("Sale", str(sale_id))

        if customer_name is not None:
            sale.customer_name = customer_name
        if notes is not None:
            sale.notes = notes
        if installments is not None:
            sale.installments = installments
        if seller is not None:
            sale.seller = seller

        if items is not None:
            normalized_items, new_total = self._normalize_items(
                items,
                force_delivered=True if delivered is True else None,
                force_paid=True if paid is True else None,
            )

            # Return already delivered stock before rebuilding items.
            current_items = list(sale.items)
            for current_item in current_items:
                delivered_qty = int(current_item.delivered_quantity or 0)
                if delivered_qty > 0:
                    self._restore_stock(current_item.product_id, delivered_qty)

            # Remove existing ORM-linked items explicitly so sale.items is in sync.
            for current_item in current_items:
                self.db.delete(current_item)
            self.db.flush()

            for item in normalized_items:
                self.db.add(SaleItem(
                    sale_id=sale.id,
                    product_id=item["product_id"],
                    quantity=item["quantity"],
                    delivered_quantity=0,
                    is_paid=False,
                    unit_price=item["unit_price"],
                    total_price=item["total_price"],
                ))
            sale.total_amount = new_total
            self.db.flush()
            self.db.refresh(sale, attribute_names=["items"])
            self._apply_item_states(
                sale,
                {item["product_id"]: item["delivered_quantity"] > 0 for item in normalized_items},
                {item["product_id"]: item["is_paid"] for item in normalized_items},
            )
        elif delivered is not None or paid is not None:
            delivery_targets = (
                {item.product_id: bool(delivered) for item in sale.items}
                if delivered is not None
                else None
            )
            paid_targets = (
                {item.product_id: bool(paid) for item in sale.items}
                if paid is not None
                else None
            )
            self._apply_item_states(sale, delivery_targets, paid_targets)
        else:
            self._sync_sale_state(sale)

        self.db.commit()
        self.db.refresh(sale)
        return sale

    def get_sale(self, sale_id: int) -> Sale:
        sale = self.db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise NotFoundError("Sale", str(sale_id))
        return sale

    def delete_sale(self, sale_id: int) -> None:
        sale = self.db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise NotFoundError("Sale", str(sale_id))

        items = self.db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
        for item in items:
            delivered_qty = int(item.delivered_quantity or 0)
            if delivered_qty > 0:
                self._restore_stock(item.product_id, delivered_qty)

        self.db.delete(sale)
        self.db.commit()

    def reconcile_delivered_stock(self) -> dict:
        """
        Rebuild StockPurchase.out_quantity from delivered sale units.

        Strategy:
        - Reset out_quantity to 0 for all stock purchases.
        - Replay delivered units from sales in chronological order using FIFO.
        """
        # 1) Reset all current deductions
        self.db.query(StockPurchase).update(
            {StockPurchase.out_quantity: 0},
            synchronize_session=False,
        )
        self.db.flush()

        sales = (
            self.db.query(Sale)
            .order_by(Sale.created_at.asc(), Sale.id.asc())
            .all()
        )

        total_units_requested = 0
        total_units_deducted = 0
        shortages: list[str] = []

        for sale in sales:
            for item in sale.items:
                # Full-delivered sales imply all units delivered.
                requested = int(item.delivered_quantity or 0)
                if requested <= 0:
                    continue

                remaining = requested
                total_units_requested += requested

                purchases = (
                    self.db.query(StockPurchase)
                    .filter(StockPurchase.product_id == item.product_id)
                    .order_by(StockPurchase.purchase_date.asc(), StockPurchase.id.asc())
                    .all()
                )

                for purchase in purchases:
                    if remaining <= 0:
                        break
                    available = int((purchase.quantity or 0) - (purchase.out_quantity or 0))
                    if available <= 0:
                        continue
                    deduct = min(available, remaining)
                    purchase.out_quantity = int((purchase.out_quantity or 0) + deduct)
                    remaining -= deduct
                    total_units_deducted += deduct

                if remaining > 0:
                    shortages.append(
                        f"Venta #{sale.id}, producto #{item.product_id}: faltan {remaining} unidades para descontar"
                    )

            # Keep delivered flags/amounts consistent with delivered quantities.
            self._sync_sale_state(sale)

        self.db.commit()
        return {
            "sales_processed": len(sales),
            "units_requested": total_units_requested,
            "units_deducted": total_units_deducted,
            "shortages": shortages,
        }
