"""Expenses endpoints."""
from typing import Optional
from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.expense import Expense
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseResponse, ExpenseListResponse

router = APIRouter()


@router.get("", response_model=ExpenseListResponse)
def list_expenses(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(Expense)
    if date_from:
        q = q.filter(Expense.date >= date_from)
    if date_to:
        q = q.filter(Expense.date <= date_to)
    items = q.order_by(Expense.date.desc(), Expense.id.desc()).all()
    total = sum(e.amount for e in items) if items else Decimal("0")
    return ExpenseListResponse(items=items, total=total)


@router.post("", response_model=ExpenseResponse, status_code=201)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    expense = Expense(
        date=data.date,
        description=data.description,
        payment_method=data.payment_method,
        amount=data.amount,
        notes=data.notes,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.put("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    if data.date is not None:
        expense.date = data.date
    if data.description is not None:
        expense.description = data.description
    if data.payment_method is not None:
        expense.payment_method = data.payment_method
    if data.amount is not None:
        expense.amount = data.amount
    if data.notes is not None:
        expense.notes = data.notes
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    db.delete(expense)
    db.commit()
