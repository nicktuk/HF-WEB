"""Pydantic schemas for request/response validation."""
from app.schemas.source_website import (
    SourceWebsiteCreate,
    SourceWebsiteUpdate,
    SourceWebsiteResponse,
    SourceWebsiteListResponse,
)
from app.schemas.product import (
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    ProductPublicResponse,
    ProductListResponse,
    ProductAdminResponse,
    PendingPriceChangeResponse,
    PendingPriceAction,
    ProductBulkWholesaleMarkup,
    ProductSelectedExport,
)
from app.schemas.market_price import (
    MarketPriceResponse,
    MarketPriceStatsResponse,
    PriceSourceResponse,
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
)
from app.schemas.sales import (
    SaleItemCreate,
    SaleCreate,
    SaleUpdate,
    SaleItemResponse,
    SaleResponse,
)

__all__ = [
    # Source Website
    "SourceWebsiteCreate",
    "SourceWebsiteUpdate",
    "SourceWebsiteResponse",
    "SourceWebsiteListResponse",
    # Product
    "ProductCreate",
    "ProductUpdate",
    "ProductResponse",
    "ProductPublicResponse",
    "ProductListResponse",
    "ProductAdminResponse",
    "PendingPriceChangeResponse",
    "PendingPriceAction",
    "ProductBulkWholesaleMarkup",
    "ProductSelectedExport",
    # Market Price
    "MarketPriceResponse",
    "MarketPriceStatsResponse",
    "PriceSourceResponse",
    # Common
    "PaginationParams",
    "PaginatedResponse",
    "MessageResponse",
    # Stock
    "StockPurchaseResponse",
    "StockImportResponse",
    "StockPreviewResponse",
    "StockPurchaseUpdate",
    # Sales
    "SaleItemCreate",
    "SaleCreate",
    "SaleUpdate",
    "SaleItemResponse",
    "SaleResponse",
]
