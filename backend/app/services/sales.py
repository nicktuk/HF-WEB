"""Service for Sales operations."""
from datetime import datetime, timezone, date
from decimal import Decimal
from typing import List, Dict, Any
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func

from app.models.sale import Sale, SaleItem, SaleInstallment
from app.models.product import Product, ProductColorStock
from app.models.stock import StockPurchase
from app.models.catalog_seller import CatalogSeller, require_active_catalog_seller
from sqlalchemy import or_
from app.core.exceptions import NotFoundError, ValidationError


class SalesService:
    def __init__(self, db: Session):
        self.db = db

    def _get_available_stock(self, product_id: int | None) -> int:
        if product_id is None:
            return 0
        qty = (
            self.db.query(
                func.coalesce(func.sum(StockPurchase.quantity - StockPurchase.out_quantity), 0)
            )
            .filter(StockPurchase.product_id == product_id)
            .scalar()
        )
        return int(qty or 0)

    def _deduct_stock(self, product_id: int | None, quantity: int) -> None:
        """Deduct stock from purchases (FIFO)."""
        if quantity <= 0:
            return
        if product_id is None:
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
        self._sync_on_demand_flag(product_id)

    def _sync_on_demand_flag(self, product_id: int | None) -> None:
        if product_id is None:
            return
        stock = self._get_available_stock(product_id)
        product = self.db.query(Product).filter(Product.id == product_id).first()
        if product is None:
            return
        product.is_on_demand = stock <= 0

    def _get_seller_deposit_id(self, seller_id: int | None) -> int | None:
        if not seller_id:
            return None
        from app.models.stock import Deposit
        deposit = (
            self.db.query(Deposit)
            .filter(Deposit.seller_id == seller_id, Deposit.is_active == True)
            .first()
        )
        return deposit.id if deposit else None

    def _deduct_color_stock(self, product_id: int | None, color: str | None, quantity: int, deposit_id: int | None = None) -> None:
        if not color or quantity <= 0 or product_id is None:
            return
        query = self.db.query(ProductColorStock).filter(
            ProductColorStock.product_id == product_id,
            ProductColorStock.color == color,
        )
        if deposit_id is not None:
            query = query.filter(ProductColorStock.deposit_id == deposit_id)
        stock = query.first()
        available = int(stock.quantity) if stock else 0
        if available < quantity:
            raise ValidationError(f"Stock insuficiente del color {color} en el depósito. Disponible: {available}")
        stock.quantity = available - quantity

    def _restore_color_stock(self, product_id: int | None, color: str | None, quantity: int, deposit_id: int | None = None) -> None:
        if not color or quantity <= 0 or product_id is None:
            return
        query = self.db.query(ProductColorStock).filter(
            ProductColorStock.product_id == product_id,
            ProductColorStock.color == color,
        )
        if deposit_id is not None:
            query = query.filter(ProductColorStock.deposit_id == deposit_id)
        stock = query.first()
        if stock is None:
            stock = ProductColorStock(product_id=product_id, color=color, quantity=0, deposit_id=deposit_id)
            self.db.add(stock)
        stock.quantity = int(stock.quantity) + quantity

    def _restore_stock(self, product_id: int | None, quantity: int) -> None:
        """Restore stock to purchases by decreasing out_quantity (LIFO)."""
        if quantity <= 0:
            return
        if product_id is None:
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
        self._sync_on_demand_flag(product_id)

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
        seen_item_refs: set[str] = set()
        for item in raw_items:
            product_id = getattr(item, "product_id", None)
            product_name = (getattr(item, "product_name", None) or "").strip()
            product = None
            manual_product_name = None

            if product_id is not None:
                product = self.db.query(Product).filter(Product.id == product_id).first()
                if not product:
                    raise NotFoundError("Product", str(product_id))
                item_ref = f"product:{product.id}:{(getattr(item, 'color', None) or '').lower()}"
            else:
                if not product_name:
                    raise ValidationError("El item manual requiere nombre de producto")
                manual_product_name = product_name
                item_ref = f"manual:{manual_product_name.lower()}"

            if item_ref in seen_item_refs:
                raise ValidationError("No se permite repetir el mismo producto en la venta")
            seen_item_refs.add(item_ref)

            color = getattr(item, "color", None) or None

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
                "item_ref": item_ref,
                "product_id": product.id if product else None,
                "manual_product_name": manual_product_name,
                "color": color,
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
        delivered_all = True
        has_items = bool(sale.items)

        for item in sale.items:
            qty = int(item.quantity or 0)
            delivered_full = qty > 0 and int(item.delivered_quantity or 0) >= qty
            if not delivered_full:
                delivered_all = False
            if delivered_full:
                delivered_amount += Decimal(str(item.total_price or 0)).quantize(Decimal("0.01"))

        sale.delivered_amount = delivered_amount.quantize(Decimal("0.01"))
        sale.delivered = has_items and delivered_all

        if sale.installment_list:
            paid_amount = sum(
                (Decimal(str(inst.amount or 0)) for inst in sale.installment_list if inst.paid),
                Decimal("0"),
            ).quantize(Decimal("0.01"))
            sale.paid_amount = paid_amount
            sale.paid = all(inst.paid for inst in sale.installment_list)
        else:
            paid_amount = Decimal("0.00")
            paid_all = True
            for item in sale.items:
                if not item.is_paid:
                    paid_all = False
                else:
                    paid_amount += Decimal(str(item.total_price or 0)).quantize(Decimal("0.01"))
            sale.paid_amount = paid_amount.quantize(Decimal("0.01"))
            sale.paid = has_items and paid_all

    def _apply_item_states(
        self,
        sale: Sale,
        delivery_targets_by_ref: dict[str, bool] | None = None,
        paid_targets_by_ref: dict[str, bool] | None = None,
    ) -> None:
        seller_deposit_id = self._get_seller_deposit_id(sale.seller_id)
        for item in sale.items:
            item_ref = f"product:{item.product_id}:{(item.color or '').lower()}" if item.product_id is not None else f"manual:{(item.manual_product_name or '').strip().lower()}"
            current_qty = int(item.delivered_quantity or 0)
            qty = int(item.quantity or 0)
            current_delivered = qty > 0 and current_qty >= qty
            target_delivered = delivery_targets_by_ref.get(item_ref, current_delivered) if delivery_targets_by_ref is not None else current_delivered
            target_qty = qty if target_delivered else 0
            delta = target_qty - current_qty
            if delta > 0:
                self._deduct_stock(item.product_id, delta)
                self._deduct_color_stock(item.product_id, item.color, delta, deposit_id=seller_deposit_id)
                # Record which deposit was used so restoration is exact
                if seller_deposit_id is not None:
                    item.deposit_id = seller_deposit_id
            elif delta < 0:
                self._restore_stock(item.product_id, -delta)
                # Use the deposit recorded at deduction time, fallback to seller's current deposit
                restore_deposit_id = item.deposit_id if item.deposit_id is not None else seller_deposit_id
                self._restore_color_stock(item.product_id, item.color, -delta, deposit_id=restore_deposit_id)
            item.delivered_quantity = target_qty

            if paid_targets_by_ref is not None:
                item.is_paid = bool(paid_targets_by_ref.get(item_ref, item.is_paid))

        self._sync_sale_state(sale)

    def _create_installments(
        self,
        sale: Sale,
        n: int,
        total_amount: Decimal,
        custom_amounts: list | None = None,
    ) -> None:
        if custom_amounts and len(custom_amounts) == n:
            amounts = [Decimal(str(a)).quantize(Decimal("0.01")) for a in custom_amounts]
        else:
            base = (total_amount / Decimal(n)).quantize(Decimal("0.01"))
            remainder = total_amount - base * Decimal(n - 1)
            amounts = [base] * (n - 1) + [remainder]

        for i, amt in enumerate(amounts, 1):
            self.db.add(SaleInstallment(sale_id=sale.id, number=i, amount=amt, paid=False))
        self.db.flush()

    def create_sale(self, data) -> Sale:
        require_active_catalog_seller(self.db, data.seller_id)
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
            seller_id=data.seller_id,
            delivered=data.delivered,
            paid=data.paid,
            payment_method=getattr(data, 'payment_method', None),
            phone=getattr(data, 'phone', None),
            email=getattr(data, 'email', None),
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
                manual_product_name=item["manual_product_name"],
                color=item.get("color"),
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
            {item["item_ref"]: item["delivered_quantity"] > 0 for item in items},
            {item["item_ref"]: item["is_paid"] for item in items},
        )

        if data.installments and data.installments > 0:
            self._create_installments(sale, data.installments, total_amount, getattr(data, "installment_amounts", None))

        self.db.commit()
        self.db.refresh(sale)
        return sale

    def create_public_order(self, data) -> Sale:
        """Create a sale from a public catalog order (no unit price supplied by caller)."""
        if not data.items:
            raise ValidationError("El pedido debe tener al menos un producto")

        seen_item_refs: set[str] = set()
        item_dicts: list[dict] = []
        total_amount = Decimal("0")

        for item in data.items:
            product = self.db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                raise NotFoundError("Product", str(item.product_id))

            color = item.color or None
            item_ref = f"product:{product.id}:{(color or '').lower()}"
            if item_ref in seen_item_refs:
                raise ValidationError(
                    f"El producto '{product.custom_name or product.original_name or product.id}' "
                    "está duplicado en el pedido"
                )
            seen_item_refs.add(item_ref)

            is_card = getattr(data, 'is_card_payment', False)
            if is_card and product.installment_price and product.installments_3:
                unit_price = Decimal(str(product.installment_price)) * 3
            else:
                unit_price = Decimal(str(product.final_price or 0))

            if unit_price <= 0:
                raise ValidationError(
                    f"El producto '{product.custom_name or product.original_name or product.id}' "
                    "no tiene precio configurado"
                )

            qty = int(item.quantity)
            total_price = (unit_price * Decimal(qty)).quantize(Decimal("0.01"))
            total_amount += total_price

            item_dicts.append({
                "item_ref": item_ref,
                "product_id": product.id,
                "color": color,
                "quantity": qty,
                "unit_price": unit_price,
                "total_price": total_price,
            })

        total_amount = total_amount.quantize(Decimal("0.01"))

        web_seller_id = self.db.query(CatalogSeller.id).filter(CatalogSeller.nombre == "Web").scalar()

        sale = Sale(
            customer_name=data.name,
            notes=data.notes,
            seller_id=web_seller_id,
            payment_method=data.payment_method,
            phone=data.phone,
            email=data.email,
            total_amount=total_amount,
            delivered=False,
            paid=False,
            delivered_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
        )
        self.db.add(sale)
        self.db.flush()

        for item in item_dicts:
            self.db.add(SaleItem(
                sale_id=sale.id,
                product_id=item["product_id"],
                manual_product_name=None,
                color=item["color"],
                quantity=item["quantity"],
                delivered_quantity=0,
                is_paid=False,
                unit_price=item["unit_price"],
                total_price=item["total_price"],
            ))

        self.db.commit()
        self.db.refresh(sale)
        return sale

    def list_sales(
        self,
        limit: int = 50,
        search: str | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> list[Sale]:
        query = self.db.query(Sale).options(
            selectinload(Sale.items).selectinload(SaleItem.product),
            selectinload(Sale.installment_list),
        )

        if search:
            search_term = f"%{search}%"
            query = query.outerjoin(SaleItem).outerjoin(Product).filter(
                or_(
                    Sale.customer_name.ilike(search_term),
                    Product.custom_name.ilike(search_term),
                    Product.original_name.ilike(search_term),
                    Product.codigo_interno.ilike(search_term),
                    SaleItem.manual_product_name.ilike(search_term),
                )
            ).distinct()

        if date_from:
            query = query.filter(Sale.created_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.filter(Sale.created_at <= datetime.combine(date_to, datetime.max.time()))

        return query.order_by(Sale.created_at.desc()).limit(limit).all()

    def update_installment(self, sale_id: int, installment_id: int, data) -> Sale:
        sale = self.db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise NotFoundError("Sale", str(sale_id))

        installment = (
            self.db.query(SaleInstallment)
            .filter(SaleInstallment.id == installment_id, SaleInstallment.sale_id == sale_id)
            .first()
        )
        if not installment:
            raise NotFoundError("SaleInstallment", str(installment_id))

        if data.amount is not None:
            installment.amount = data.amount
        if data.paid is not None:
            installment.paid = data.paid
            if data.paid and installment.paid_at is None:
                installment.paid_at = datetime.now(timezone.utc)
            elif not data.paid:
                installment.paid_at = None

        self._sync_sale_state(sale)
        self.db.commit()
        self.db.refresh(sale)
        return sale

    def update_sale(
        self,
        sale_id: int,
        delivered: bool | None,
        paid: bool | None,
        payment_method: str | None = None,
        customer_name: str | None = None,
        notes: str | None = None,
        installments: int | None = None,
        installment_amounts: list | None = None,
        seller_id: int | None = None,
        items: list | None = None,
        force: bool = False,
    ) -> Sale:
        sale = self.db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise NotFoundError("Sale", str(sale_id))

        if customer_name is not None:
            sale.customer_name = customer_name
        if notes is not None:
            sale.notes = notes
        if seller_id is not None:
            require_active_catalog_seller(self.db, seller_id)
            sale.seller_id = seller_id
        if payment_method is not None:
            sale.payment_method = payment_method

        if installments is not None:
            sale.installments = installments
            for inst in list(sale.installment_list):
                self.db.delete(inst)
            self.db.flush()
            if installments > 0:
                current_total = Decimal(str(sale.total_amount or 0))
                self._create_installments(sale, installments, current_total, installment_amounts)
                self.db.refresh(sale, attribute_names=["installment_list"])

        if items is not None:
            normalized_items, new_total = self._normalize_items(
                items,
                force_delivered=True if delivered is True else None,
                force_paid=True if paid is True else None,
            )

            current_items = list(sale.items)

            def _item_ref_of(ci: SaleItem) -> str:
                return (
                    f"product:{ci.product_id}:{(ci.color or '').lower()}"
                    if ci.product_id is not None
                    else f"manual:{(ci.manual_product_name or '').strip().lower()}"
                )

            # Snapshot previous delivery state keyed by item_ref
            current_state: dict[str, tuple[int, int | None]] = {
                _item_ref_of(ci): (int(ci.delivered_quantity or 0), ci.deposit_id)
                for ci in current_items
            }
            incoming_refs = {ni["item_ref"] for ni in normalized_items}

            # Only restore stock for items being REMOVED from the sale.
            # Items that remain are handled via delta in _apply_item_states below.
            for ci in current_items:
                ref = _item_ref_of(ci)
                if ref in incoming_refs:
                    continue
                delivered_qty = int(ci.delivered_quantity or 0)
                if delivered_qty > 0:
                    restore_deposit_id = ci.deposit_id
                    if force:
                        try:
                            self._restore_stock(ci.product_id, delivered_qty)
                            self._restore_color_stock(ci.product_id, ci.color, delivered_qty, deposit_id=restore_deposit_id)
                        except ValidationError:
                            pass
                    else:
                        self._restore_stock(ci.product_id, delivered_qty)
                        self._restore_color_stock(ci.product_id, ci.color, delivered_qty, deposit_id=restore_deposit_id)

            # Remove existing ORM-linked items explicitly so sale.items is in sync.
            for ci in current_items:
                self.db.delete(ci)
            self.db.flush()

            # Re-create items carrying forward previous delivered_quantity as baseline
            # so _apply_item_states only deducts/restores the *delta*, not the full qty.
            for ni in normalized_items:
                prev_qty, prev_deposit_id = current_state.get(ni["item_ref"], (0, None))
                self.db.add(SaleItem(
                    sale_id=sale.id,
                    product_id=ni["product_id"],
                    manual_product_name=ni["manual_product_name"],
                    color=ni.get("color"),
                    quantity=ni["quantity"],
                    delivered_quantity=prev_qty,
                    deposit_id=prev_deposit_id,
                    is_paid=False,
                    unit_price=ni["unit_price"],
                    total_price=ni["total_price"],
                ))
            sale.total_amount = new_total
            self.db.flush()
            self.db.refresh(sale, attribute_names=["items"])
            self._apply_item_states(
                sale,
                {ni["item_ref"]: ni["delivered_quantity"] > 0 for ni in normalized_items},
                {ni["item_ref"]: ni["is_paid"] for ni in normalized_items},
            )
        elif delivered is not None or paid is not None:
            delivery_targets = (
                {
                    (f"product:{item.product_id}:{(item.color or '').lower()}" if item.product_id is not None else f"manual:{(item.manual_product_name or '').strip().lower()}"): bool(delivered)
                    for item in sale.items
                }
                if delivered is not None
                else None
            )
            paid_targets = (
                {
                    (f"product:{item.product_id}:{(item.color or '').lower()}" if item.product_id is not None else f"manual:{(item.manual_product_name or '').strip().lower()}"): bool(paid)
                    for item in sale.items
                }
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
        sale = (
            self.db.query(Sale)
            .options(
                selectinload(Sale.items).selectinload(SaleItem.product),
                selectinload(Sale.installment_list),
            )
            .filter(Sale.id == sale_id)
            .first()
        )
        if not sale:
            raise NotFoundError("Sale", str(sale_id))
        return sale

    def delete_sale(self, sale_id: int, force: bool = False) -> None:
        sale = self.db.query(Sale).filter(Sale.id == sale_id).first()
        if not sale:
            raise NotFoundError("Sale", str(sale_id))

        items = self.db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
        for item in items:
            delivered_qty = int(item.delivered_quantity or 0)
            if delivered_qty > 0:
                # Use the deposit recorded at delivery time for exact restoration
                restore_deposit_id = item.deposit_id
                if force:
                    try:
                        self._restore_stock(item.product_id, delivered_qty)
                        self._restore_color_stock(item.product_id, item.color, delivered_qty, deposit_id=restore_deposit_id)
                    except ValidationError:
                        pass
                else:
                    self._restore_stock(item.product_id, delivered_qty)
                    self._restore_color_stock(item.product_id, item.color, delivered_qty, deposit_id=restore_deposit_id)

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
                if item.product_id is None:
                    continue
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

        # Sync is_on_demand flag for all products based on current stock
        from app.models.product import Product as ProductModel
        from sqlalchemy import text as sa_text
        self.db.execute(sa_text("""
            UPDATE products
            SET is_on_demand = CASE
                WHEN id IN (
                    SELECT product_id FROM stock_purchases
                    GROUP BY product_id
                    HAVING SUM(quantity - out_quantity) > 0
                ) THEN false
                ELSE true
            END
        """))
        self.db.commit()
        return {
            "sales_processed": len(sales),
            "units_requested": total_units_requested,
            "units_deducted": total_units_deducted,
            "shortages": shortages,
        }

    def customer_ranking(self) -> List[Dict[str, Any]]:
        """Return aggregated sales data grouped by customer name.

        Two separate subqueries avoid double-counting: joining Sale with SaleItem
        (1-to-many) would multiply total_amount and purchase_count by the number
        of items per sale.
        """
        # Subquery 1: per-customer sale count and total amount (no item join)
        sale_agg = (
            self.db.query(
                Sale.customer_name.label("customer_name"),
                func.count(Sale.id).label("purchase_count"),
                func.coalesce(func.sum(Sale.total_amount), 0).label("total_amount"),
            )
            .group_by(Sale.customer_name)
            .subquery()
        )

        # Subquery 2: per-customer sum of item quantities
        item_agg = (
            self.db.query(
                Sale.customer_name.label("customer_name"),
                func.coalesce(func.sum(SaleItem.quantity), 0).label("product_count"),
            )
            .join(SaleItem, SaleItem.sale_id == Sale.id)
            .group_by(Sale.customer_name)
            .subquery()
        )

        rows = (
            self.db.query(
                sale_agg.c.customer_name,
                sale_agg.c.purchase_count,
                func.coalesce(item_agg.c.product_count, 0).label("product_count"),
                sale_agg.c.total_amount,
            )
            .outerjoin(item_agg, sale_agg.c.customer_name == item_agg.c.customer_name)
            .order_by(sale_agg.c.total_amount.desc())
            .all()
        )

        return [
            {
                "customer_name": row.customer_name or "Sin nombre",
                "purchase_count": row.purchase_count,
                "product_count": int(row.product_count),
                "total_amount": float(row.total_amount),
            }
            for row in rows
        ]
