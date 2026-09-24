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
    origen = Column(String(20), nullable=False, default="admin")
    delivery_method = Column(String(20), nullable=True)  # pickup | shipping | agreement
    shipping_zone = Column(String(20), nullable=True)  # amba | resto_pais
    shipping_street = Column(String(255), nullable=True)
    shipping_floor_apt = Column(String(100), nullable=True)
    shipping_city = Column(String(150), nullable=True)
    shipping_province = Column(String(100), nullable=True)
    shipping_postal_code = Column(String(20), nullable=True)
    shipping_reference = Column(String(255), nullable=True)
    delivered = Column(Boolean, default=False, nullable=False)
    paid = Column(Boolean, default=False, nullable=False)
    payment_method = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(200), nullable=True)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    delivered_amount = Column(Numeric(12, 2), nullable=False, default=0)
    paid_amount = Column(Numeric(12, 2), nullable=False, default=0)
    # Override manual de la comisión del vendedor para esta venta puntual —
    # a lo sumo uno de los dos, pisa la matriz semanal configurada en el
    # admin (ComisionMinoristaTramo). Ver services/comisiones.py.
    comision_porcentaje_manual = Column(Numeric(5, 2), nullable=True)
    comision_monto_manual = Column(Numeric(12, 2), nullable=True)

    seller = relationship("CatalogSeller")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    installment_list = relationship(
        "SaleInstallment",
        back_populates="sale",
        cascade="all, delete-orphan",
        order_by="SaleInstallment.number",
    )
    comision = relationship("Comision", back_populates="sale", uselist=False)

    @property
    def seller_nombre(self) -> str:
        return self.seller.nombre

    @property
    def comision_tasa(self):
        return self.comision.tasa if self.comision else None

    @property
    def comision_monto(self):
        return self.comision.monto if self.comision else None

    @property
    def comision_estado(self) -> str | None:
        return self.comision.estado if self.comision else None


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
    # Snapshot de si el producto estaba en oferta (Product.is_on_sale) al
    # cargarse el item — define qué parte de la venta comisiona al % de ofertas.
    es_oferta = Column(Boolean, nullable=False, default=False)

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
