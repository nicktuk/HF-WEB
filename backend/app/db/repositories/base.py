"""Base repository with common CRUD operations."""
from typing import Generic, TypeVar, Type, Optional, List, Any
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models.base import Base

T = TypeVar("T", bound=Base)


class BaseRepository(Generic[T]):
    """
    Generic repository with CRUD operations.

    Usage:
        class ProductRepository(BaseRepository[Product]):
            pass

        repo = ProductRepository(Product, db)
        product = repo.get(1)
    """

    def __init__(self, model: Type[T], db: Session):
        self.model = model
        self.db = db

    def get(self, id: int) -> Optional[T]:
        """Get a single record by ID."""
        return self.db.query(self.model).filter(self.model.id == id).first()

    def get_multi(
        self,
        skip: int = 0,
        limit: int = 100,
        order_by: Any = None
    ) -> List[T]:
        """Get multiple records with pagination."""
        query = self.db.query(self.model)
        if order_by is not None:
            query = query.order_by(order_by)
        return query.offset(skip).limit(limit).all()

    def get_all(self) -> List[T]:
        """Get all records."""
        return self.db.query(self.model).all()

    def create(self, obj: T) -> T:
        """Create a new record."""
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def create_many(self, objects: List[T]) -> List[T]:
        """Create multiple records."""
        self.db.add_all(objects)
        self.db.commit()
        for obj in objects:
            self.db.refresh(obj)
        return objects

    def update(self, obj: T) -> T:
        """Update an existing record."""
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, obj: T) -> None:
        """Delete a record."""
        self.db.delete(obj)
        self.db.commit()

    def delete_by_id(self, id: int) -> bool:
        """Delete a record by ID. Returns True if deleted."""
        obj = self.get(id)
        if obj:
            self.delete(obj)
            return True
        return False

    def count(self) -> int:
        """Count all records."""
        return self.db.query(self.model).count()

    def exists(self, id: int) -> bool:
        """Check if a record exists."""
        return self.db.query(self.model).filter(self.model.id == id).first() is not None
