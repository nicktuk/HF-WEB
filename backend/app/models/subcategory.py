"""
Subcategory model - Subcategorías de productos asociadas a categorías.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base


class Subcategory(Base):
    """
    Subcategoría de productos.

    Es una lista maestra de subcategorías disponibles.
    Cada subcategoría pertenece a una categoría.
    Los productos referencian subcategorías por nombre (string).
    """
    __tablename__ = "subcategories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    color = Column(String(7), default="#6b7280", nullable=False, comment="Color hex para el badge (ej: #3b82f6)")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship to Category
    category = relationship("Category", backref="subcategories")

    # Unique constraint: name must be unique within each category
    __table_args__ = (
        UniqueConstraint('name', 'category_id', name='uq_subcategory_name_category'),
    )

    def __repr__(self):
        return f"<Subcategory {self.name} (category_id={self.category_id})>"
