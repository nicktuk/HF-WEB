"""Schemas for SourceWebsite."""
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field, HttpUrl, field_validator
import re


class ScraperConfig(BaseModel):
    """Configuration for scraping a source website."""
    product_url_pattern: str = Field(
        default="/producto/{slug}/",
        description="URL pattern for product pages. Use {slug} as placeholder."
    )
    selectors: Dict[str, str] = Field(
        default_factory=lambda: {
            "name": ".product_title",
            "price": ".price .amount",
            "description": ".woocommerce-product-details__short-description",
            "images": ".woocommerce-product-gallery img",
            "categories": ".breadcrumb a"
        },
        description="CSS selectors for extracting product data"
    )
    requires_auth: bool = Field(default=False)
    rate_limit_per_minute: int = Field(default=30, ge=1, le=120)


class SourceWebsiteBase(BaseModel):
    """Base schema for SourceWebsite."""
    name: str = Field(..., min_length=2, max_length=100, description="Unique identifier name")
    display_name: str = Field(..., min_length=2, max_length=200)
    base_url: str = Field(..., description="Base URL of the website")
    is_active: bool = Field(default=True)
    scraper_config: Optional[ScraperConfig] = None
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        """Name must be lowercase, alphanumeric with underscores/hyphens."""
        if not re.match(r'^[a-z0-9_-]+$', v):
            raise ValueError("Name must contain only lowercase letters, numbers, underscores, and hyphens")
        return v

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v: str) -> str:
        """Ensure base_url is valid and normalize it."""
        if not v.startswith(("http://", "https://")):
            raise ValueError("Base URL must start with http:// or https://")
        return v.rstrip("/")


class SourceWebsiteCreate(SourceWebsiteBase):
    """Schema for creating a SourceWebsite."""
    pass


class SourceWebsiteUpdate(BaseModel):
    """Schema for updating a SourceWebsite."""
    display_name: Optional[str] = Field(None, min_length=2, max_length=200)
    base_url: Optional[str] = None
    is_active: Optional[bool] = None
    scraper_config: Optional[ScraperConfig] = None
    notes: Optional[str] = None

    @field_validator("base_url")
    @classmethod
    def validate_base_url(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.startswith(("http://", "https://")):
                raise ValueError("Base URL must start with http:// or https://")
            return v.rstrip("/")
        return v


class SourceWebsiteResponse(BaseModel):
    """Response schema for SourceWebsite."""
    id: int
    name: str
    display_name: str
    base_url: str
    is_active: bool
    scraper_config: Optional[Dict[str, Any]] = None
    notes: Optional[str] = None
    product_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SourceWebsiteListResponse(BaseModel):
    """Response schema for list of SourceWebsites."""
    items: List[SourceWebsiteResponse]
    total: int
