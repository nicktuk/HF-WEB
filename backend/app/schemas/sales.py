"""Schemas for sales."""
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel, Field


class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    unit_price: Decimal = Field(..., gt=0)
    delivered: Optional[bool] = None
    paid: Optional[bool] = None
    delivered_quantity: Optional[int] = Field(default=None, ge=0)


class SaleCreate(BaseModel):
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    installments: Optional[int] = Field(default=None, ge=0)
    seller: str = Field(default="Facu", pattern="^(Facu|Heber)$")
    delivered: bool = False
    paid: bool = False
    items: List[SaleItemCreate]


class SaleUpdate(BaseModel):
    delivered: Optional[bool] = None
    paid: Optional[bool] = None
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    installments: Optional[int] = Field(default=None, ge=0)
    seller: Optional[str] = Field(default=None, pattern="^(Facu|Heber)$")
    items: Optional[List[SaleItemCreate]] = None


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: Optional[str] = None
    quantity: int
    delivered_quantity: int
    delivered: bool
    paid: bool
    unit_price: Decimal
    total_price: Decimal

    class Config:
        from_attributes = True


class SaleResponse(BaseModel):
    id: int
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    installments: Optional[int] = None
    seller: str
    delivered: bool
    paid: bool
    total_amount: Decimal
    delivered_amount: Decimal
    paid_amount: Decimal
    items: List[SaleItemResponse]

    class Config:
        from_attributes = True
