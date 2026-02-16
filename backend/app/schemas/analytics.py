"""Schemas for public analytics events."""
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field


PublicEventName = Literal[
    "page_view",
    "search",
    "category_click",
    "subcategory_click",
    "product_click",
    "whatsapp_click",
]


class PublicEventCreate(BaseModel):
    """Payload accepted from the public frontend event tracker."""

    event_name: PublicEventName
    session_id: Optional[str] = Field(default=None, max_length=100)
    path: Optional[str] = Field(default=None, max_length=500)
    referrer: Optional[str] = Field(default=None, max_length=1000)
    category: Optional[str] = Field(default=None, max_length=100)
    subcategory: Optional[str] = Field(default=None, max_length=100)
    product_id: Optional[int] = Field(default=None, ge=1)
    product_slug: Optional[str] = Field(default=None, max_length=255)
    search_query: Optional[str] = Field(default=None, max_length=200)
    metadata: Optional[dict[str, Any]] = None
