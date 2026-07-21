"""
Sales models - Ventas y sus items.
"""
from sqlalchemy import Column, Integer, String, Boolean, Numeric, ForeignKey, Index, Text, DateTime
from sqlalchemy.orm import relationship
from app.models.base import Base


class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    installments = Column(Integer, nullable=True)
    seller_id = Column(Integer, ForeignKey("catalog_sellers.id"), nullable=False)
    delivered = Column(Boolean, default=False, nullable=False)
    paid = Column(Boolean, default=False, nullable=False)
    payment_method = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(200), nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    delivered_amount = Column(Numeric(12, 2), nullable=False, default=0)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0)

    seller = relationship("CatalogSeller")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    installment_list = relationship(
        "SaleInstallment",
        back_populates="sale",
        cascade="all, delete-orphan",
        order_by="SaleInstallment.number",
    )

    @property
    def seller_nombre(self) -> str:
        return self.seller.nombre


class SaleInstallment(Base):
    __tablename__ = "sale_installments"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    number = Column(Integer, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    paid = Column(Boolean, nullable=False, default=False)
    paid_at = Column(DateTime(timezone=True), nullable=True)

    sale = relationship("Sale", back_populates="installment_list")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)
    manual_product_name = Column(String(500), nullable=True)
    color = Column(String(20), nullable=True)
    deposit_id = Column(Integer, ForeignKey("deposits.id", ondelete="SET NULL"), nullable=True)
    quantity = Column(Integer, nullable=False)
    delivered_quantity = Column(Integer, nullable=False, default=0)
    is_paid = Column(Boolean, nullable=False, default=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(12, 2), nullable=False)

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product")

    @property
    def product_name(self) -> str | None:
        if self.product:
            return self.product.display_name_with_code
        return self.manual_product_name

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
