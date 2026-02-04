"""Category schemas."""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class CategoryBase(BaseModel):
    """Base category schema."""
    name: str = Field(..., min_length=1, max_length=100)
    is_active: bool = True
    display_order: int = 0
    color: str = Field(default="#6b7280", pattern=r'^#[0-9a-fA-F]{6}$')
    show_in_menu: bool = False


class CategoryCreate(CategoryBase):
    """Schema for creating a category."""
    pass


class CategoryUpdate(BaseModel):
    """Schema for updating a category."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')
    show_in_menu: Optional[bool] = None


class CategoryResponse(CategoryBase):
    """Schema for category response."""
    id: int
    product_count: int = 0
    enabled_product_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
