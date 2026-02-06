"""Subcategory schemas."""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class SubcategoryBase(BaseModel):
    """Base subcategory schema."""
    name: str = Field(..., min_length=1, max_length=100)
    category_id: int
    is_active: bool = True
    display_order: int = 0
    color: str = Field(default="#6b7280", pattern=r'^#[0-9a-fA-F]{6}$')


class SubcategoryCreate(SubcategoryBase):
    """Schema for creating a subcategory."""
    pass


class SubcategoryUpdate(BaseModel):
    """Schema for updating a subcategory."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')


class SubcategoryResponse(SubcategoryBase):
    """Schema for subcategory response."""
    id: int
    category_name: Optional[str] = None
    product_count: int = 0
    enabled_product_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SubcategoryPublicResponse(BaseModel):
    """Schema for public subcategory response (simplified)."""
    name: str
    category_name: str
    color: str

    class Config:
        from_attributes = True
