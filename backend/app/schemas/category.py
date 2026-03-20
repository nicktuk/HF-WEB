"""Category schemas."""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class CategoryBase(BaseModel):
    """Base category schema."""
    name: str = Field(..., min_length=1, max_length=100)
    is_active: bool = True
    display_order: int = 0
    color: str = Field(default="#6b7280", pattern=r'^#[0-9a-fA-F]{6}$')
    show_in_menu: bool = False
    show_in_carousel: bool = False
    carousel_title: Optional[str] = Field(None, max_length=100)
    carousel_subtitle: Optional[str] = Field(None, max_length=200)
    carousel_image_url: Optional[str] = Field(None, max_length=500)
    carousel_bg_color: Optional[str] = Field(default="#0D1B2A", pattern=r'^#[0-9a-fA-F]{6}$')
    carousel_text_color: Optional[str] = Field(default="#ffffff", pattern=r'^#[0-9a-fA-F]{6}$')
    carousel_font: Optional[str] = Field(default="sans", max_length=50)
    carousel_filter_type: Optional[str] = Field(None, max_length=50)


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
    show_in_carousel: Optional[bool] = None
    carousel_title: Optional[str] = Field(None, max_length=100)
    carousel_subtitle: Optional[str] = Field(None, max_length=200)
    carousel_image_url: Optional[str] = Field(None, max_length=500)
    carousel_bg_color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')
    carousel_text_color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')
    carousel_font: Optional[str] = Field(None, max_length=50)
    carousel_filter_type: Optional[str] = Field(None, max_length=50)


class CategoryResponse(CategoryBase):
    """Schema for category response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_count: int = 0
    enabled_product_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CategoryMappingCreate(BaseModel):
    source_name: str = Field(..., min_length=1, max_length=100)
    category_id: int
    apply_existing: bool = True


class CategoryMappingResponse(BaseModel):
    id: int
    source_name: str
    source_key: str
    category_id: int
    category_name: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UnmappedCategoryResponse(BaseModel):
    source_name: str
    product_count: int


class SourceCategoryProductResponse(BaseModel):
    id: int
    slug: str
    name: str
    enabled: bool
    source_category: str
    source_website_name: Optional[str] = None
    mapped_category_id: Optional[int] = None
    mapped_category_name: Optional[str] = None
