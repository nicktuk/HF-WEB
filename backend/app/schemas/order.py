"""Pydantic schemas for orders."""
from typing import Optional, List, Literal
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class OrderItemCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    quantity: int = Field(default=1, ge=1)
    estimated_price: Optional[Decimal] = Field(None, ge=0)


class OrderAttachmentCreate(BaseModel):
    url: str = Field(..., min_length=1, max_length=1000)
    type: Literal["image", "link"] = "image"
    label: Optional[str] = Field(None, max_length=200)


class OrderCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=200)
    notes: Optional[str] = None
    seller: str = Field(default="Facu", max_length=20)
    items: List[OrderItemCreate] = []
    attachments: List[OrderAttachmentCreate] = []


class OrderUpdate(BaseModel):
    customer_name: Optional[str] = Field(None, min_length=1, max_length=200)
    notes: Optional[str] = None
    seller: Optional[str] = Field(None, max_length=20)
    items: Optional[List[OrderItemCreate]] = None
    attachments: Optional[List[OrderAttachmentCreate]] = None


class OrderClose(BaseModel):
    action: Literal["sale", "no_sale"]
    linked_sale_id: Optional[int] = None
    no_sale_reason: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: int
    description: str
    quantity: int
    estimated_price: Optional[Decimal] = None

    class Config:
        from_attributes = True


class OrderAttachmentResponse(BaseModel):
    id: int
    url: str
    type: str
    label: Optional[str] = None

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    customer_name: str
    notes: Optional[str] = None
    seller: str
    status: str
    linked_sale_id: Optional[int] = None
    no_sale_reason: Optional[str] = None
    items: List[OrderItemResponse] = []
    attachments: List[OrderAttachmentResponse] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class OrderStats(BaseModel):
    active_count: int = 0
    completed_sale_count: int = 0
    completed_no_sale_count: int = 0
