"""
Stock models - compras de stock por producto.
"""
from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.models.base import Base


class StockPurchase(Base):
    """Compra/lote de stock asociado a un producto."""
    __tablename__ = "stock_purchases"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True)

    description = Column(String(500), nullable=True)
    code = Column(String(100), nullable=True, index=True)
    purchase_date = Column(Date, nullable=False, index=True)
    unit_price = Column(Numeric(10, 2), nullable=False)
    quantity = Column(Integer, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    out_quantity = Column(Integer, nullable=False, default=0, comment="Cantidad salida (OUT) para este lote")

    # Relaciones
    product = relationship("Product")
    payments = relationship("StockPurchasePayment", back_populates="stock_purchase", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_stock_purchases_product_date", "product_id", "purchase_date"),
    )


class StockPurchasePayment(Base):
    """Pago asociado a una compra de stock."""
    __tablename__ = "stock_purchase_payments"

    id = Column(Integer, primary_key=True, index=True)
    stock_purchase_id = Column(Integer, ForeignKey("stock_purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    payer = Column(String(20), nullable=False)  # "Facu" o "Heber"
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(String(50), nullable=False)  # "Efectivo", "Transferencia", etc.

    # Relación
    stock_purchase = relationship("StockPurchase", back_populates="payments")
