"""Schemas for stock operations."""
from datetime import date, datetime
from decimal import Decimal
from typing import List, Literal, Optional
from pydantic import BaseModel


class StockPurchasePaymentResponse(BaseModel):
    id: int
    payer: str
    amount: Decimal
    payment_method: str

    class Config:
        from_attributes = True


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


class StockPurchaseDetailResponse(StockPurchaseResponse):
    """Detalle de compra con pagos y nombre de producto."""
    payments: List[StockPurchasePaymentResponse] = []
    product_name: str | None = None

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


class StockPurchaseUpdate(BaseModel):
    product_id: Optional[int] = None


class StockSummaryRequest(BaseModel):
    product_ids: List[int]


class StockSummaryResponse(BaseModel):
    items: List[dict]


class PaymentCreate(BaseModel):
    payer: Literal["Facu", "Heber"]
    amount: Decimal
    payment_method: str


class AddPaymentRequest(BaseModel):
    payments: List[PaymentCreate]


class PurchasesByPayerResponse(BaseModel):
    payer: str
    total_amount: Decimal
    payment_count: int


class AllPurchasesFilters(BaseModel):
    page: int = 1
    limit: int = 50
    payer: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    product_id: Optional[int] = None
