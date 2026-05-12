"""Schemas for sales."""
from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from pydantic import BaseModel, Field


class SaleItemCreate(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    color: Optional[str] = None
    quantity: int = Field(..., gt=0)
    unit_price: Decimal = Field(..., gt=0)
    delivered: Optional[bool] = None
    paid: Optional[bool] = None
    delivered_quantity: Optional[int] = Field(default=None, ge=0)


class SaleCreate(BaseModel):
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    installments: Optional[int] = Field(default=None, ge=0)
    installment_amounts: Optional[List[Decimal]] = None
    seller: str = Field(default="Facu", pattern="^(Facu|Heber)$")
    delivered: bool = False
    paid: bool = False
    payment_method: Optional[str] = None
    items: List[SaleItemCreate]


class SaleUpdate(BaseModel):
    delivered: Optional[bool] = None
    paid: Optional[bool] = None
    payment_method: Optional[str] = None
    customer_name: Optional[str] = None
    notes: Optional[str] = None
    installments: Optional[int] = Field(default=None, ge=0)
    installment_amounts: Optional[List[Decimal]] = None
    seller: Optional[str] = Field(default=None, pattern="^(Facu|Heber)$")
    items: Optional[List[SaleItemCreate]] = None
    force: bool = False


class SaleInstallmentUpdate(BaseModel):
    amount: Optional[Decimal] = Field(default=None, gt=0)
    paid: Optional[bool] = None


class SaleItemResponse(BaseModel):
    id: int
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    color: Optional[str] = None
    quantity: int
    delivered_quantity: int
    delivered: bool
    paid: bool
    unit_price: Decimal
    total_price: Decimal

    class Config:
        from_attributes = True


class SaleInstallmentResponse(BaseModel):
    id: int
    number: int
    amount: Decimal
    paid: bool
    paid_at: Optional[datetime] = None

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
    payment_method: Optional[str] = None
    total_amount: Decimal
    delivered_amount: Decimal
    paid_amount: Decimal
    items: List[SaleItemResponse]
    installment_list: List[SaleInstallmentResponse] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
