"""
Category model - Categorías de productos.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import func
from app.models.base import Base


class Category(Base):
    """
    Categoría de productos.

    Es una lista maestra de categorías disponibles.
    Los productos referencian categorías por nombre (string).
    """
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    display_order = Column(Integer, default=0, nullable=False)
    color = Column(String(7), default="#6b7280", nullable=False, comment="Color hex para el badge (ej: #3b82f6)")
    show_in_menu = Column(Boolean, default=False, nullable=False, comment="Mostrar como filtro rapido en mobile")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<Category {self.name}>"
