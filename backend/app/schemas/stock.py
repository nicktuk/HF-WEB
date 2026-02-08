"""Schemas for stock operations."""
from datetime import date, datetime
from decimal import Decimal
from typing import List
from pydantic import BaseModel


class StockPurchaseResponse(BaseModel):
    id: int
    product_id: int | None = None
    description: str | None = None
    code: str | None = None
    purchase_date: date
    unit_price: Decimal
    quantity: int
    total_amount: Decimal
    out_quantity: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class StockImportResponse(BaseModel):
    created: int
    skipped: int
    errors: List[str]
    touched_products: int


class StockPreviewRow(BaseModel):
    row_number: int
    description: str | None = None
    code: str | None = None
    derived_code: bool = False
    purchase_date: date | None = None
    unit_price: Decimal | None = None
    quantity: int | None = None
    total_amount: Decimal | None = None
    product_id: int | None = None
    product_name: str | None = None
    status: str
    errors: List[str] = []


class StockPreviewResponse(BaseModel):
    rows: List[StockPreviewRow]
    summary: dict
