"""Schemas for Product."""
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator, computed_field
import re


class ProductImageResponse(BaseModel):
    """Response schema for product image."""
    id: int
    url: str
    alt_text: Optional[str] = None
    is_primary: bool = False

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    """Schema for creating a product (by scraping from slug)."""
    source_website_id: int = Field(..., description="ID of the source website")
    slug: str = Field(..., min_length=3, max_length=255, description="Product slug from source website")
    markup_percentage: Decimal = Field(default=Decimal("0"), ge=0)
    enabled: bool = Field(default=False)
    category: Optional[str] = Field(None, max_length=100)

    @field_validator("slug")
    @classmethod
    def validate_slug(cls, v: str) -> str:
        """Slug must be URL-safe."""
        if not re.match(r'^[a-z0-9-]+$', v.lower()):
            raise ValueError("Slug must contain only lowercase letters, numbers, and hyphens")
        return v.lower()


class ProductUpdate(BaseModel):
    """Schema for updating a product - allows editing all fields."""
    enabled: Optional[bool] = None
    is_featured: Optional[bool] = None
    markup_percentage: Optional[Decimal] = Field(None, ge=0)
    custom_name: Optional[str] = Field(None, max_length=500)
    custom_price: Optional[Decimal] = Field(None, ge=0)
    display_order: Optional[int] = Field(None, ge=0)
    category: Optional[str] = Field(None, max_length=100)
    # Extended fields for full editing
    description: Optional[str] = Field(None, max_length=5000)
    short_description: Optional[str] = Field(None, max_length=1000)
    brand: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    image_urls: Optional[List[str]] = Field(None, max_length=10)

    @field_validator("custom_name")
    @classmethod
    def sanitize_custom_name(cls, v: Optional[str]) -> Optional[str]:
        """Remove potentially dangerous characters."""
        if v:
            v = re.sub(r'<[^>]+>', '', v)
            return v.strip()
        return v

    @field_validator("image_urls")
    @classmethod
    def validate_urls(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate image URLs."""
        if v is None:
            return None
        validated = []
        for url in v:
            url = url.strip()
            if url and (url.startswith("http://") or url.startswith("https://")):
                validated.append(url)
        return validated


class ProductResponse(BaseModel):
    """Base response schema for product."""
    id: int
    slug: str
    original_name: str
    custom_name: Optional[str] = None
    original_price: Optional[Decimal] = None
    markup_percentage: Decimal
    custom_price: Optional[Decimal] = None
    description: Optional[str] = None
    short_description: Optional[str] = None
    brand: Optional[str] = None
    sku: Optional[str] = None
    category: Optional[str] = None
    enabled: bool
    is_featured: bool = False
    images: List[ProductImageResponse] = []
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def display_name(self) -> str:
        return self.custom_name or self.original_name

    @computed_field
    @property
    def final_price(self) -> Optional[Decimal]:
        if self.custom_price is not None:
            return self.custom_price
        if self.original_price is not None:
            return self.original_price * (1 + self.markup_percentage / 100)
        return None

    class Config:
        from_attributes = True


class ProductPublicResponse(BaseModel):
    """Public response schema (for customer-facing catalog)."""
    id: int
    slug: str
    name: str  # display_name
    price: Optional[Decimal] = None  # final_price
    currency: str = "ARS"
    short_description: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    is_featured: bool = False
    images: List[ProductImageResponse] = []
    source_url: Optional[str] = None

    class Config:
        from_attributes = True


class ProductAdminResponse(ProductResponse):
    """Extended response for admin panel."""
    source_website_id: int
    source_website_name: Optional[str] = None
    source_url: Optional[str] = None
    last_scraped_at: Optional[datetime] = None
    scrape_error_count: int = 0
    scrape_last_error: Optional[str] = None
    display_order: int = 0

    # Market intelligence
    market_avg_price: Optional[Decimal] = None
    market_min_price: Optional[Decimal] = None
    market_max_price: Optional[Decimal] = None
    market_sample_count: int = 0

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    """Response for paginated product list."""
    items: List[ProductResponse]
    total: int
    page: int
    limit: int
    pages: int


class ProductBulkAction(BaseModel):
    """Schema for bulk actions on products."""
    product_ids: List[int] = Field(..., min_length=1, max_length=100)
    action: str = Field(..., pattern="^(enable|disable|delete)$")


class ProductBulkMarkup(BaseModel):
    """Schema for bulk markup update."""
    markup_percentage: Decimal = Field(..., ge=0, description="Markup percentage to apply")
    only_enabled: bool = Field(default=True, description="Only update enabled products")


class ProductActivateInactive(BaseModel):
    """Schema for activating all inactive products with markup."""
    markup_percentage: Decimal = Field(..., ge=0, description="Markup percentage to apply to activated products")


class ProductActivateSelected(BaseModel):
    """Schema for activating selected products with markup."""
    product_ids: List[int] = Field(..., min_length=1, max_length=500, description="List of product IDs to activate")
    markup_percentage: Decimal = Field(..., ge=0, description="Markup percentage to apply")
    category: Optional[str] = Field(None, max_length=100, description="Category to assign to products")


class ProductChangeCategorySelected(BaseModel):
    """Schema for changing category of selected products."""
    product_ids: List[int] = Field(..., min_length=1, max_length=500, description="List of product IDs")
    category: str = Field(..., min_length=1, max_length=100, description="Category to assign")


class ProductDisableSelected(BaseModel):
    """Schema for disabling selected products."""
    product_ids: List[int] = Field(..., min_length=1, max_length=500, description="List of product IDs to disable")


class ProductCreateManual(BaseModel):
    """Schema for creating a product manually (without scraping)."""
    name: str = Field(..., min_length=1, max_length=500, description="Product name")
    price: Decimal = Field(..., gt=0, description="Product price")
    description: Optional[str] = Field(None, max_length=5000)
    short_description: Optional[str] = Field(None, max_length=1000)
    brand: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    category: Optional[str] = Field(None, max_length=100)
    image_urls: List[str] = Field(default_factory=list, max_length=10)
    enabled: bool = Field(default=True)
    is_featured: bool = Field(default=False, description="Marcar como novedad")
    is_immediate_delivery: bool = Field(default=False, description="Entrega inmediata")

    @field_validator("name")
    @classmethod
    def sanitize_name(cls, v: str) -> str:
        """Remove potentially dangerous characters."""
        v = re.sub(r'<[^>]+>', '', v)
        return v.strip()

    @field_validator("image_urls")
    @classmethod
    def validate_urls(cls, v: List[str]) -> List[str]:
        """Validate image URLs."""
        validated = []
        for url in v:
            url = url.strip()
            if url and (url.startswith("http://") or url.startswith("https://")):
                validated.append(url)
        return validated
