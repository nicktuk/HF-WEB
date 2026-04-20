"""Expense model."""
from sqlalchemy import Column, Integer, String, Numeric, Date, Text, DateTime, func
from app.models.base import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    description = Column(String(500), nullable=False)
    payment_method = Column(String(100), nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<Expense(id={self.id}, date={self.date}, amount={self.amount})>"
