"""Order models for quick order entry."""
from sqlalchemy import Column, Integer, String, Text, Numeric, ForeignKey
from sqlalchemy.orm import relationship
from app.models.base import Base


class Order(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(200), nullable=False)
    notes = Column(Text, nullable=True)
    seller = Column(String(20), nullable=False, default="Facu")
    status = Column(String(20), nullable=False, default="active")  # active | completed_sale | completed_no_sale
    linked_sale_id = Column(Integer, ForeignKey("sales.id", ondelete="SET NULL"), nullable=True)
    no_sale_reason = Column(Text, nullable=True)

    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")
    attachments = relationship("OrderAttachment", back_populates="order", cascade="all, delete-orphan")
    linked_sale = relationship("Sale", foreign_keys=[linked_sale_id])


class OrderItem(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String(500), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    estimated_price = Column(Numeric(10, 2), nullable=True)

    order = relationship("Order", back_populates="items")


class OrderAttachment(Base):
    __tablename__ = "order_attachments"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(1000), nullable=False)
    type = Column(String(10), nullable=False, default="image")  # image | link
    label = Column(String(200), nullable=True)

    order = relationship("Order", back_populates="attachments")
