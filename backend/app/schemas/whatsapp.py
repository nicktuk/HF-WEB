"""Schemas for WhatsApp message generation."""
from typing import Optional, List
from pydantic import BaseModel, Field


class WhatsAppFilterRequest(BaseModel):
    """Request to filter products for message generation."""
    is_featured: Optional[bool] = Field(None, description="Filter by 'Nuevo'")
    is_immediate_delivery: Optional[bool] = Field(None, description="Filter by 'Entrega inmediata'")
    is_best_seller: Optional[bool] = Field(None, description="Filter by 'Lo más vendido'")
    category: Optional[str] = Field(None, max_length=100)
    limit: int = Field(default=20, ge=1, le=100)


class WhatsAppMessageRequest(BaseModel):
    """Request to generate WhatsApp messages."""
    product_ids: List[int] = Field(..., min_length=1, max_length=50)
    template: str = Field(
        default="default",
        pattern="^(default|promo|nuevos|mas_vendidos|custom)$"
    )
    include_price: bool = Field(default=True)
    custom_text: Optional[str] = Field(None, max_length=1000)


class WhatsAppProductItem(BaseModel):
    """Product item for WhatsApp message."""
    id: int
    name: str
    price: Optional[float] = None
    image_url: Optional[str] = None
    is_featured: bool = False
    is_immediate_delivery: bool = False
    is_best_seller: bool = False
    category: Optional[str] = None


class WhatsAppMessageResponse(BaseModel):
    """Response with generated message for a single product."""
    text: str
    image_url: Optional[str] = None
    product_id: int
    product_name: str


class WhatsAppBulkMessageResponse(BaseModel):
    """Response with generated message for multiple products (combined)."""
    text: str
    images: List[dict]  # [{product_id, product_name, image_url}]
    product_count: int
