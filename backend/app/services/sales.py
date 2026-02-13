"""Service for Sales operations."""
from decimal import Decimal, ROUND_DOWN
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

    def _normalize_items(self, raw_items) -> tuple[list[dict], Decimal]:
        if not raw_items:
            raise ValidationError("La venta debe tener items")

        items: list[dict] = []
        total_amount = Decimal("0")
        for item in raw_items:
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                raise NotFoundError("Product", str(item.product_id))

            qty = int(item.quantity)
            if qty <= 0:
                raise ValidationError("La cantidad debe ser mayor a 0")
            unit_price = Decimal(str(item.unit_price))
            if unit_price <= 0:
                raise ValidationError("El precio unitario debe ser mayor a 0")
            total_price = (unit_price * Decimal(qty)).quantize(Decimal("0.01"))

            items.append({
                "product_id": product.id,
                "quantity": qty,
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

    def _build_delivery_targets(self, sale: Sale, requested_amount: Decimal) -> tuple[dict[int, int], Decimal]:
        items = list(sale.items)
        total = Decimal(str(sale.total_amount or 0)).quantize(Decimal("0.01"))
        target_amount = self._clamp_amount(requested_amount, total)
        remaining = target_amount
        targets: dict[int, int] = {}
        actual_amount = Decimal("0.00")

        for item in items:
            unit_price = Decimal(str(item.unit_price or 0))
            if unit_price <= 0:
                targets[item.id] = 0
                continue
            max_qty = int(item.quantity or 0)
            affordable = int((remaining / unit_price).to_integral_value(rounding=ROUND_DOWN))
            qty = min(max_qty, max(0, affordable))
            targets[item.id] = qty
            line_amount = (unit_price * Decimal(qty)).quantize(Decimal("0.01"))
            actual_amount += line_amount
            remaining -= line_amount

        return targets, actual_amount.quantize(Decimal("0.01"))

    def _apply_delivery_amount(self, sale: Sale, requested_amount: Decimal) -> None:
        targets, effective_amount = self._build_delivery_targets(sale, requested_amount)

        for item in sale.items:
            current_qty = int(item.delivered_quantity or 0)
            target_qty = targets.get(item.id, 0)
            delta = target_qty - current_qty
            if delta > 0:
                self._deduct_stock(item.product_id, delta)
            elif delta < 0:
                self._restore_stock(item.product_id, -delta)
            item.delivered_quantity = target_qty

        sale.delivered_amount = effective_amount
        total = Decimal(str(sale.total_amount or 0)).quantize(Decimal("0.01"))
        sale.delivered = total > 0 and effective_amount >= total

    def _apply_paid_amount(self, sale: Sale, requested_amount: Decimal) -> None:
        total = Decimal(str(sale.total_amount or 0)).quantize(Decimal("0.01"))
        effective_amount = self._clamp_amount(requested_amount, total)
        sale.paid_amount = effective_amount
        sale.paid = total > 0 and effective_amount >= total

    def create_sale(self, data) -> Sale:
        items, total_amount = self._normalize_items(data.items)

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
                unit_price=item["unit_price"],
                total_price=item["total_price"],
            )
            self.db.add(sale_item)

        self.db.flush()

        # Delivery state
        if data.delivered_amount is not None:
            delivery_target = Decimal(str(data.delivered_amount))
        elif data.delivered:
            delivery_target = total_amount
        else:
            delivery_target = Decimal("0.00")
        self._apply_delivery_amount(sale, delivery_target)

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
        delivered_amount: Decimal | None = None,
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
            normalized_items, new_total = self._normalize_items(items)

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
                    delivered_quantity=0,
                    unit_price=item["unit_price"],
                    total_price=item["total_price"],
                ))
            sale.total_amount = new_total
            self.db.flush()

        # Delivery target amount takes precedence over boolean if both are sent.
        if delivered_amount is not None:
            delivery_target = Decimal(str(delivered_amount))
        elif delivered is not None:
            delivery_target = Decimal(str(sale.total_amount)) if delivered else Decimal("0.00")
        else:
            delivery_target = Decimal(str(sale.delivered_amount or 0))
        self._apply_delivery_amount(sale, delivery_target)

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
