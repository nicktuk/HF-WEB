"""Section models."""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class Section(Base):
    __tablename__ = "sections"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    subtitle = Column(String(200), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    # Criteria: 'manual' | 'featured' | 'immediate_delivery' | 'best_seller' | 'category'
    criteria_type = Column(String(50), nullable=False, default="manual")
    criteria_value = Column(String(100), nullable=True, comment="For category type: category name")
    max_products = Column(Integer, default=8, nullable=False)
    bg_color = Column(String(7), default="#0D1B2A", nullable=True)
    text_color = Column(String(7), default="#ffffff", nullable=True)
    image_url = Column(String(500), nullable=True)
    position = Column(String(10), nullable=False, default="abajo")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    products = relationship("SectionProduct", back_populates="section", order_by="SectionProduct.display_order", cascade="save-update, merge", passive_deletes=True)


class SectionProduct(Base):
    __tablename__ = "section_products"

    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    section = relationship("Section", back_populates="products")
    product = relationship("Product")
