"""Common schemas used across the application."""
from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel, Field

T = TypeVar("T")


class PaginationParams(BaseModel):
    """Pagination parameters for list endpoints."""
    page: int = Field(default=1, ge=1, description="Page number")
    limit: int = Field(default=20, ge=1, le=100, description="Items per page")

    @property
    def skip(self) -> int:
        return (self.page - 1) * self.limit


class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response wrapper."""
    items: List[T]
    total: int
    page: int
    limit: int
    pages: int

    @classmethod
    def create(cls, items: List[T], total: int, page: int, limit: int):
        pages = (total + limit - 1) // limit if limit > 0 else 0
        return cls(items=items, total=total, page=page, limit=limit, pages=pages)


class MessageResponse(BaseModel):
    """Simple message response."""
    message: str
    success: bool = True


class ErrorResponse(BaseModel):
    """Error response."""
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None
