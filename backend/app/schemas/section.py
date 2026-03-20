"""Section schemas."""
from typing import Optional, List, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class SectionBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    subtitle: Optional[str] = Field(None, max_length=200)
    display_order: int = 0
    is_active: bool = True
    criteria_type: str = Field(default="manual", max_length=50)
    criteria_value: Optional[str] = Field(None, max_length=100)
    max_products: int = Field(default=8, ge=1, le=50)
    bg_color: Optional[str] = Field(default="#0D1B2A", pattern=r'^#[0-9a-fA-F]{6}$')
    text_color: Optional[str] = Field(default="#ffffff", pattern=r'^#[0-9a-fA-F]{6}$')


class SectionCreate(SectionBase):
    pass


class SectionUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    subtitle: Optional[str] = Field(None, max_length=200)
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    criteria_type: Optional[str] = Field(None, max_length=50)
    criteria_value: Optional[str] = Field(None, max_length=100)
    max_products: Optional[int] = Field(None, ge=1, le=50)
    bg_color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')
    text_color: Optional[str] = Field(None, pattern=r'^#[0-9a-fA-F]{6}$')


class SectionProductAdd(BaseModel):
    product_id: int
    display_order: int = 0


class ProductInSection(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    slug: str
    name: str
    price: Optional[Any] = None
    currency: str = "ARS"
    brand: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    is_featured: bool = False
    is_immediate_delivery: bool = False
    is_check_stock: bool = False
    is_best_seller: bool = False
    images: List[Any] = []


class SectionResponse(SectionBase):
    model_config = ConfigDict(from_attributes=True)
    id: int
    products: List[ProductInSection] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
