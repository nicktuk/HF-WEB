"""Order service - business logic for quick orders."""
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.models.order import Order, OrderItem, OrderAttachment
from app.schemas.order import OrderCreate, OrderUpdate, OrderClose, OrderStats
from app.core.exceptions import NotFoundError, ValidationError


class OrdersService:
    def __init__(self, db: Session):
        self.db = db

    def create_order(self, data: OrderCreate) -> Order:
        order = Order(
            customer_name=data.customer_name,
            notes=data.notes,
            seller=data.seller,
        )
        self.db.add(order)
        self.db.flush()

        for item_data in data.items:
            item = OrderItem(
                order_id=order.id,
                description=item_data.description,
                quantity=item_data.quantity,
                estimated_price=item_data.estimated_price,
            )
            self.db.add(item)

        for att_data in data.attachments:
            att = OrderAttachment(
                order_id=order.id,
                url=att_data.url,
                type=att_data.type,
                label=att_data.label,
            )
            self.db.add(att)

        self.db.commit()
        self.db.refresh(order)
        return order

    def list_orders(
        self,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
    ) -> List[Order]:
        query = self.db.query(Order)

        if status:
            query = query.filter(Order.status == status)

        if search:
            pattern = f"%{search}%"
            query = query.outerjoin(OrderItem).filter(
                or_(
                    Order.customer_name.ilike(pattern),
                    Order.notes.ilike(pattern),
                    OrderItem.description.ilike(pattern),
                )
            ).distinct()

        return query.order_by(Order.created_at.desc()).limit(limit).all()

    def get_order(self, order_id: int) -> Order:
        order = self.db.query(Order).filter(Order.id == order_id).first()
        if not order:
            raise NotFoundError("Order", str(order_id))
        return order

    def update_order(self, order_id: int, data: OrderUpdate) -> Order:
        order = self.get_order(order_id)

        if order.status != "active":
            raise ValidationError("Solo se pueden editar pedidos activos")

        if data.customer_name is not None:
            order.customer_name = data.customer_name
        if data.notes is not None:
            order.notes = data.notes
        if data.seller is not None:
            order.seller = data.seller

        if data.items is not None:
            # Replace all items
            for item in order.items:
                self.db.delete(item)
            self.db.flush()
            for item_data in data.items:
                item = OrderItem(
                    order_id=order.id,
                    description=item_data.description,
                    quantity=item_data.quantity,
                    estimated_price=item_data.estimated_price,
                )
                self.db.add(item)

        if data.attachments is not None:
            # Replace all attachments
            for att in order.attachments:
                self.db.delete(att)
            self.db.flush()
            for att_data in data.attachments:
                att = OrderAttachment(
                    order_id=order.id,
                    url=att_data.url,
                    type=att_data.type,
                    label=att_data.label,
                )
                self.db.add(att)

        self.db.commit()
        self.db.refresh(order)
        return order

    def close_order(self, order_id: int, data: OrderClose) -> Order:
        order = self.get_order(order_id)

        if order.status != "active":
            raise ValidationError("Solo se pueden cerrar pedidos activos")

        if data.action == "sale":
            if not data.linked_sale_id:
                raise ValidationError("Se requiere el ID de venta para cerrar con venta")
            order.status = "completed_sale"
            order.linked_sale_id = data.linked_sale_id
        elif data.action == "no_sale":
            if not data.no_sale_reason:
                raise ValidationError("Se requiere un motivo para cerrar sin venta")
            order.status = "completed_no_sale"
            order.no_sale_reason = data.no_sale_reason

        self.db.commit()
        self.db.refresh(order)
        return order

    def reopen_order(self, order_id: int) -> Order:
        order = self.get_order(order_id)

        if order.status == "active":
            raise ValidationError("El pedido ya esta activo")

        order.status = "active"
        order.linked_sale_id = None
        order.no_sale_reason = None

        self.db.commit()
        self.db.refresh(order)
        return order

    def delete_order(self, order_id: int) -> None:
        order = self.get_order(order_id)
        self.db.delete(order)
        self.db.commit()

    def get_order_stats(self) -> OrderStats:
        counts = (
            self.db.query(Order.status, func.count(Order.id))
            .group_by(Order.status)
            .all()
        )
        stats = OrderStats()
        for status, count in counts:
            if status == "active":
                stats.active_count = count
            elif status == "completed_sale":
                stats.completed_sale_count = count
            elif status == "completed_no_sale":
                stats.completed_no_sale_count = count
        return stats

    def add_attachment(self, order_id: int, url: str, att_type: str = "image", label: Optional[str] = None) -> OrderAttachment:
        order = self.get_order(order_id)
        if order.status != "active":
            raise ValidationError("Solo se pueden agregar adjuntos a pedidos activos")

        att = OrderAttachment(
            order_id=order.id,
            url=url,
            type=att_type,
            label=label,
        )
        self.db.add(att)
        self.db.commit()
        self.db.refresh(att)
        return att

    def delete_attachment(self, order_id: int, attachment_id: int) -> None:
        att = (
            self.db.query(OrderAttachment)
            .filter(OrderAttachment.id == attachment_id, OrderAttachment.order_id == order_id)
            .first()
        )
        if not att:
            raise NotFoundError("OrderAttachment", str(attachment_id))
        self.db.delete(att)
        self.db.commit()
