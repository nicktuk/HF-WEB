"""Schemas for Expense."""
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class ExpenseCreate(BaseModel):
    date: date
    description: str = Field(..., min_length=1, max_length=500)
    payment_method: Optional[str] = Field(None, max_length=100)
    amount: Decimal = Field(..., gt=0)
    notes: Optional[str] = None


class ExpenseUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    payment_method: Optional[str] = Field(None, max_length=100)
    amount: Optional[Decimal] = Field(None, gt=0)
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: int
    date: date
    description: str
    payment_method: Optional[str] = None
    amount: Decimal
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExpenseListResponse(BaseModel):
    items: List[ExpenseResponse]
    total: Decimal
