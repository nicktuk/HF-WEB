from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.models.base import Base


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    api_key = Column(String(128), unique=True, nullable=False, index=True)
    role = Column(String(50), nullable=False, default="superadmin")  # superadmin | product_editor
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<AdminUser(id={self.id}, name={self.name!r}, role={self.role!r})>"
