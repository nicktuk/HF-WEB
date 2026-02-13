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

    def _normalize_items(self, raw_items, force_delivered: bool | None = None) -> tuple[list[dict], Decimal]:
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
            delivered_qty_raw = item.delivered_quantity if getattr(item, "delivered_quantity", None) is not None else None
            delivered_qty = qty if force_delivered is True else 0 if force_delivered is False else int(delivered_qty_raw or 0)
            if delivered_qty < 0 or delivered_qty > qty:
                raise ValidationError("La cantidad entregada debe estar entre 0 y la cantidad del item")

            items.append({
                "product_id": product.id,
                "quantity": qty,
                "delivered_quantity": delivered_qty,
                "unit_price": unit_price,
                "total_price": total_price,
            })
            total_amount += total_price

        return items, total_amount.quantize(Decimal("0.01"))

    def _clamp_amount(self, amount: Decimal, total: Decimal) -> Decimal:
        if amount < 0:
            return Decimal("0.00")
        if amount > total:
            return total
        return amount.quantize(Decimal("0.01"))

    def _sync_delivery_state(self, sale: Sale) -> None:
        delivered_amount = Decimal("0.00")
        delivered_all = True
        has_items = False

        for item in sale.items:
            has_items = True
            delivered_qty = int(item.delivered_quantity or 0)
            qty = int(item.quantity or 0)
            if delivered_qty < qty:
                delivered_all = False
            line = (Decimal(str(item.unit_price or 0)) * Decimal(delivered_qty)).quantize(Decimal("0.01"))
            delivered_amount += line

        sale.delivered_amount = delivered_amount.quantize(Decimal("0.01"))
        sale.delivered = has_items and delivered_all

    def _apply_delivered_quantities(self, sale: Sale, targets_by_product: dict[int, int]) -> None:
        for item in sale.items:
            current_qty = int(item.delivered_quantity or 0)
            target_qty = int(targets_by_product.get(item.product_id, current_qty))
            max_qty = int(item.quantity or 0)
            if target_qty < 0 or target_qty > max_qty:
                raise ValidationError("La cantidad entregada debe estar entre 0 y la cantidad del item")
            delta = target_qty - current_qty
            if delta > 0:
                self._deduct_stock(item.product_id, delta)
            elif delta < 0:
                self._restore_stock(item.product_id, -delta)
            item.delivered_quantity = target_qty

        self._sync_delivery_state(sale)

    def _apply_paid_amount(self, sale: Sale, requested_amount: Decimal) -> None:
        total = Decimal(str(sale.total_amount or 0)).quantize(Decimal("0.01"))
        effective_amount = self._clamp_amount(requested_amount, total)
        sale.paid_amount = effective_amount
        sale.paid = total > 0 and effective_amount >= total

    def create_sale(self, data) -> Sale:
        items, total_amount = self._normalize_items(
            data.items,
            force_delivered=True if data.delivered else None,
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
                delivered_quantity=item["delivered_quantity"],
                unit_price=item["unit_price"],
                total_price=item["total_price"],
            )
            self.db.add(sale_item)

        self.db.flush()
        self._apply_delivered_quantities(
            sale,
            {item["product_id"]: item["delivered_quantity"] for item in items},
        )

        # Payment state
        if data.paid_amount is not None:
            paid_target = Decimal(str(data.paid_amount))
        elif data.paid:
            paid_target = total_amount
        else:
            paid_target = Decimal("0.00")
        self._apply_paid_amount(sale, paid_target)

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
        paid_amount: Decimal | None = None,
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
            )

            # Return already delivered stock before rebuilding items.
            for current_item in sale.items:
                delivered_qty = int(current_item.delivered_quantity or 0)
                if delivered_qty > 0:
                    self._restore_stock(current_item.product_id, delivered_qty)

            self.db.query(SaleItem).filter(SaleItem.sale_id == sale.id).delete(synchronize_session=False)
            self.db.flush()

            for item in normalized_items:
                self.db.add(SaleItem(
                    sale_id=sale.id,
                    product_id=item["product_id"],
                    quantity=item["quantity"],
                    delivered_quantity=item["delivered_quantity"],
                    unit_price=item["unit_price"],
                    total_price=item["total_price"],
                ))
            sale.total_amount = new_total
            self.db.flush()
            self._apply_delivered_quantities(
                sale,
                {item["product_id"]: item["delivered_quantity"] for item in normalized_items},
            )
        elif delivered is not None:
            targets = {
                item.product_id: int(item.quantity if delivered else 0)
                for item in sale.items
            }
            self._apply_delivered_quantities(sale, targets)
        else:
            self._sync_delivery_state(sale)

        # Paid target amount takes precedence over boolean if both are sent.
        if paid_amount is not None:
            paid_target = Decimal(str(paid_amount))
        elif paid is not None:
            paid_target = Decimal(str(sale.total_amount)) if paid else Decimal("0.00")
        else:
            paid_target = Decimal(str(sale.paid_amount or 0))
        self._apply_paid_amount(sale, paid_target)

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
                requested = int(item.quantity if sale.delivered else (item.delivered_quantity or 0))
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

        self.db.commit()
        return {
            "sales_processed": len(sales),
            "units_requested": total_units_requested,
            "units_deducted": total_units_deducted,
            "shortages": shortages,
        }
