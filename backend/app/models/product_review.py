"""ProductReview model - Calificaciones de compradores sobre productos."""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import relationship
from app.models.base import Base


class ProductReview(Base):
    """Calificación (1 a 5 estrellas) de un producto dejada por un comprador."""
    __tablename__ = "product_reviews"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    rating = Column(Integer, nullable=False)
    reviewer_name = Column(String(120), nullable=False)
    comment = Column(Text, nullable=True)

    product = relationship("Product")

    __table_args__ = (
        CheckConstraint("rating >= 1 AND rating <= 5", name="ck_product_reviews_rating_range"),
        Index("ix_product_reviews_product_created", "product_id", "created_at"),
    )

    def __repr__(self):
        return f"<ProductReview(product_id={self.product_id}, rating={self.rating})>"
