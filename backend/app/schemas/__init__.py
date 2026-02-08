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
]
