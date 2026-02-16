"""Analytics event model for public site navigation tracking."""
from sqlalchemy import Column, Integer, String, Text

from app.models.base import Base


class AnalyticsEvent(Base):
    """Stores anonymous analytics events from the public frontend."""

    __tablename__ = "analytics_events"

    id = Column(Integer, primary_key=True, index=True)
    event_name = Column(String(50), nullable=False, index=True)
    session_id = Column(String(100), nullable=True, index=True)
    path = Column(String(500), nullable=True)
    referrer = Column(String(1000), nullable=True)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(64), nullable=True)
    category = Column(String(100), nullable=True)
    subcategory = Column(String(100), nullable=True)
    product_id = Column(Integer, nullable=True, index=True)
    product_slug = Column(String(255), nullable=True, index=True)
    search_query = Column(String(200), nullable=True)
    metadata_json = Column(Text, nullable=True)
