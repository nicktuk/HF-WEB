"""Service for Sales operations."""
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.sale import Sale, SaleItem
from app.models.product import Product
from app.models.stock import StockPurchase
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

    def create_sale(self, data) -> Sale:
        if not data.items:
            raise ValidationError("La venta debe tener items")

        # Validate products and stock
        items = []
        total_amount = Decimal("0")
        for item in data.items:
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                raise NotFoundError("Product", str(item.product_id))

            qty = int(item.quantity)
            unit_price = Decimal(str(item.unit_price))
            total_price = unit_price * Decimal(qty)

            items.append({
                "product_id": product.id,
                "quantity": qty,
                "unit_price": unit_price,
                "total_price": total_price,
            })
            total_amount += total_price

        # Create sale
        sale = Sale(
            customer_name=data.customer_name,
            notes=data.notes,
            installments=data.installments,
            seller=data.seller,
            delivered=data.delivered,
            paid=data.paid,
            total_amount=total_amount,
        )
        self.db.add(sale)
        self.db.flush()

        # Create items
        for item in items:
            sale_item = SaleItem(
                sale_id=sale.id,
                product_id=item["product_id"],
                quantity=item["quantity"],
                unit_price=item["unit_price"],
                total_price=item["total_price"],
            )
            self.db.add(sale_item)

        # Deduct stock if delivered
        if sale.delivered:
            for item in items:
                self._deduct_stock(item["product_id"], item["quantity"])

        self.db.commit()
        self.db.refresh(sale)
        return sale

    def list_sales(self, limit: int = 50) -> list[Sale]:
        return (
            self.db.query(Sale)
            .order_by(Sale.created_at.desc())
            .limit(limit)
            .all()
        )

    def update_sale(self, sale_id: int, delivered: bool | None, paid: bool | None) -> Sale:
        sale = self.db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise NotFoundError("Sale", str(sale_id))

        if delivered is not None and delivered and not sale.delivered:
            # Deduct stock when switching to delivered
            items = self.db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
            for item in items:
                self._deduct_stock(item.product_id, item.quantity)

        if delivered is not None:
            sale.delivered = delivered
        if paid is not None:
            sale.paid = paid

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

        if sale.delivered:
            items = self.db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
            for item in items:
                self._restore_stock(item.product_id, item.quantity)

        self.db.delete(sale)
        self.db.commit()
