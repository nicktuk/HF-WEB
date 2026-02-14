"""
Stock models - compras y pagos.
"""
from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, Index, Text, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base


class Purchase(Base):
    """Una compra/factura completa a un mayorista."""
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    supplier = Column(String(200), nullable=False, index=True)  # Mayorista
    purchase_date = Column(Date, nullable=False, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relaciones
    items = relationship("StockPurchase", back_populates="purchase", cascade="all, delete-orphan")
    payments = relationship("PurchasePayment", back_populates="purchase", cascade="all, delete-orphan")

    @property
    def total_amount(self):
        """Calcula el total sumando todos los items."""
        return sum(float(item.total_amount or 0) for item in self.items)

    @property
    def total_paid(self):
        """Calcula el total pagado sumando todos los pagos."""
        return sum(float(payment.amount or 0) for payment in self.payments)


class StockPurchase(Base):
    """Item/producto dentro de una compra."""
    __tablename__ = "stock_purchases"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True)

    description = Column(String(500), nullable=True)
    code = Column(String(100), nullable=True, index=True)
    purchase_date = Column(Date, nullable=False, index=True)
    unit_price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    out_quantity = Column(Integer, nullable=False, default=0, comment="Cantidad salida (OUT) para este lote")

    # Relaciones
    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product")

    __table_args__ = (
        Index("ix_stock_purchases_product_date", "product_id", "purchase_date"),
    )

    @property
    def product_name(self) -> str | None:
        if self.product:
            return self.product.custom_name or self.product.original_name
        return self.description


class PurchasePayment(Base):
    """Pago asociado a una compra."""
    __tablename__ = "purchase_payments"

    id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    payer = Column(String(20), nullable=False)  # "Facu" o "Heber"
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(50), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relación
    purchase = relationship("Purchase", back_populates="payments")
