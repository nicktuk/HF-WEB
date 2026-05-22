from sqlalchemy import Column, Integer, String, Text, JSON
from app.models.base import Base


class Customer(Base):
    __tablename__ = "customers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), unique=True, nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(200), nullable=True)
    tags = Column(JSON, nullable=True, default=list)
    notes = Column(Text, nullable=True)
