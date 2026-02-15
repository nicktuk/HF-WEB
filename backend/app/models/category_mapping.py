"""
Category mapping model - Mapeo de categorias origen -> categoria maestra.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class CategoryMapping(Base):
    __tablename__ = "category_mappings"

    id = Column(Integer, primary_key=True, index=True)
    source_name = Column(String(100), nullable=False, comment="Categoria origen tal como llega")
    source_key = Column(String(100), nullable=False, unique=True, index=True, comment="Categoria origen normalizada")
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True)

    category = relationship("Category")

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    __table_args__ = (
        UniqueConstraint("source_key", name="uq_category_mappings_source_key"),
    )

    def __repr__(self):
        return f"<CategoryMapping source={self.source_name!r} category_id={self.category_id}>"
