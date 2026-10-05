"""Pydantic schemas for request/response validation."""
from app.schemas.product import (
    ProductUpdate,
    ProductResponse,
    ProductPublicResponse,
    ProductListResponse,
    ProductAdminResponse,
    ProductBulkWholesaleMarkup,
    ProductSelectedExport,
)
from app.schemas.common import (
    PaginationParams,
    PaginatedResponse,
    MessageResponse,
)
from app.schemas.stock import (
    StockPurchaseResponse,
    StockImportResponse,
    StockPreviewResponse,
    StockPurchaseUpdate,
    StockSummaryRequest,
    StockSummaryResponse,
)
from app.schemas.sales import (
    SaleItemCreate,
    SaleCreate,
    SaleUpdate,
    SaleItemResponse,
    SaleResponse,
)

__all__ = [
    # Product
    "ProductUpdate",
    "ProductResponse",
    "ProductPublicResponse",
    "ProductListResponse",
    "ProductAdminResponse",
    "ProductBulkWholesaleMarkup",
    "ProductSelectedExport",
    # Common
    "PaginationParams",
    "PaginatedResponse",
    "MessageResponse",
    # Stock
    "StockPurchaseResponse",
    "StockImportResponse",
    "StockPreviewResponse",
    "StockPurchaseUpdate",
    "StockSummaryRequest",
    "StockSummaryResponse",
    # Sales
    "SaleItemCreate",
    "SaleCreate",
    "SaleUpdate",
    "SaleItemResponse",
    "SaleResponse",
]
