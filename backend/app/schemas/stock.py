"""Schemas for stock operations."""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional
from pydantic import BaseModel


# ============================================
# Purchase Payment Schemas
# ============================================

class PurchasePaymentCreate(BaseModel):
    payer: Literal["Facu", "Heber"]
    amount: Decimal
    payment_method: str


class PurchasePaymentResponse(BaseModel):
    id: int
    payer: str
    amount: Decimal
    payment_method: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================
# Stock Purchase (Item) Schemas
# ============================================

class StockPurchaseResponse(BaseModel):
    id: int
    purchase_id: int | None = None
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


class StockPurchaseItemResponse(BaseModel):
    """Item de compra con nombre de producto."""
    id: int
    product_id: int | None = None
    product_name: str | None = None
    description: str | None = None
    code: str | None = None
    quantity: int
    unit_price: Decimal
    total_amount: Decimal

    class Config:
        from_attributes = True


# ============================================
# Purchase Schemas
# ============================================

class PurchaseCreate(BaseModel):
    supplier: str
    purchase_date: date
    notes: str | None = None


class PurchaseResponse(BaseModel):
    id: int
    supplier: str
    purchase_date: date
    notes: str | None = None
    total_amount: Decimal
    total_paid: Decimal
    item_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseDetailResponse(BaseModel):
    id: int
    supplier: str
    purchase_date: date
    notes: str | None = None
    total_amount: Decimal
    total_paid: Decimal
    created_at: datetime
    items: List[StockPurchaseItemResponse] = []
    payments: List[PurchasePaymentResponse] = []

    class Config:
        from_attributes = True


# ============================================
# Import Schemas
# ============================================

class StockImportRequest(BaseModel):
    supplier: str


class StockImportResponse(BaseModel):
    purchase_id: int
    created: int
    skipped: int
    errors: List[str]
    touched_products: int


class StockPreviewRow(BaseModel):
    row_number: int
    description: str | None = None
    code: str | None = None
    supplier: str | None = None
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


# ============================================
# Other Schemas
# ============================================

class StockPurchaseUpdate(BaseModel):
    product_id: Optional[int] = None


class StockSummaryRequest(BaseModel):
    product_ids: List[int]


class StockSummaryResponse(BaseModel):
    items: List[dict]


class AddPaymentRequest(BaseModel):
    payments: List[PurchasePaymentCreate]


class PurchasesByPayerResponse(BaseModel):
    payer: str
    total_amount: Decimal
    payment_count: int
