"""API dependencies."""
from typing import Generator
from fastapi import Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.product import ProductService
from app.services.source_website import SourceWebsiteService
from app.services.market_intelligence import MarketIntelligenceService
from app.services.sales import SalesService
from app.services.orders import OrdersService
from app.core.security import verify_admin


def get_product_service(db: Session = Depends(get_db)) -> ProductService:
    """Get product service instance."""
    return ProductService(db)


def get_source_website_service(db: Session = Depends(get_db)) -> SourceWebsiteService:
    """Get source website service instance."""
    return SourceWebsiteService(db)


def get_market_intelligence_service(db: Session = Depends(get_db)) -> MarketIntelligenceService:
    """Get market intelligence service instance."""
    return MarketIntelligenceService(db)


def get_sales_service(db: Session = Depends(get_db)) -> SalesService:
    """Get sales service instance."""
    return SalesService(db)


def get_orders_service(db: Session = Depends(get_db)) -> OrdersService:
    """Get orders service instance."""
    return OrdersService(db)
