"""
Sales models - Ventas y sus items.
"""
from sqlalchemy import Column, Integer, String, Boolean, Numeric, ForeignKey, Index, Text
from sqlalchemy.orm import relationship
from app.models.base import Base


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    installments = Column(Integer, nullable=True)
    seller = Column(String(20), nullable=False, default="Facu")
    delivered = Column(Boolean, default=False, nullable=False)
    paid = Column(Boolean, default=False, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    delivered_amount = Column(Numeric(12, 2), nullable=False, default=0)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0)

    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    quantity = Column(Integer, nullable=False)
    delivered_quantity = Column(Integer, nullable=False, default=0)
    is_paid = Column(Boolean, nullable=False, default=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")

    @property
    def product_name(self) -> str | None:
        if not self.product:
            return None
        return self.product.custom_name or self.product.original_name

    @property
    def delivered(self) -> bool:
        qty = int(self.quantity or 0)
        if qty <= 0:
            return False
        return int(self.delivered_quantity or 0) >= qty

    @property
    def paid(self) -> bool:
        return bool(self.is_paid)

    __table_args__ = (
        Index("ix_sale_items_sale_product", "sale_id", "product_id"),
    )
