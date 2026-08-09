"""Pending Mercado Pago orders — the Sale is only created once the webhook confirms payment."""
from sqlalchemy import Column, String, Integer, Numeric, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from app.models.base import Base


class MpPendingOrder(Base):
    __tablename__ = "mp_pending_orders"

    id = Column(String(36), primary_key=True)
    name = Column(String(200), nullable=False)
    phone = Column(String(50), nullable=False)
    email = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    delivery_method = Column(String(20), nullable=True)  # pickup | shipping | agreement
    shipping_zone = Column(String(20), nullable=True)  # amba | resto_pais
    shipping_street = Column(String(255), nullable=True)
    shipping_floor_apt = Column(String(100), nullable=True)
    shipping_city = Column(String(150), nullable=True)
    shipping_province = Column(String(100), nullable=True)
    shipping_postal_code = Column(String(20), nullable=True)
    shipping_reference = Column(String(255), nullable=True)
    items = Column(JSONB, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), nullable=False, default="pending")  # pending | completed | failed
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=True)
    mp_payment_id = Column(String(50), nullable=True)
