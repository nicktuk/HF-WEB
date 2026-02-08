"""
Stock models - compras de stock por producto.
"""
from sqlalchemy import Column, Integer, String, Date, Numeric, ForeignKey, Index, UniqueConstraint
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

    # RelaciÃ³n
    product = relationship("Product")

    __table_args__ = (
        UniqueConstraint(
            "product_id",
            "purchase_date",
            "unit_price",
            "quantity",
            "total_amount",
            name="uq_stock_purchases_dedupe",
        ),
        Index("ix_stock_purchases_product_date", "product_id", "purchase_date"),
    )
