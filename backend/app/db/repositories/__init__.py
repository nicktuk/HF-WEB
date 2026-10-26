"""Repository layer for data access."""
from app.db.repositories.base import BaseRepository
from app.db.repositories.product import ProductRepository

__all__ = [
    "BaseRepository",
    "ProductRepository",
]
