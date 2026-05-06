"""Endpoints de carritos — stub para paso 2, implementación completa en paso 13."""
from fastapi import APIRouter, Depends
from app.core.security import verify_admin

router = APIRouter()


@router.get("")
def list_carritos(_: bool = Depends(verify_admin)):
    return {"detail": "pendiente de implementación"}


@router.post("")
def create_carrito(_: bool = Depends(verify_admin)):
    return {"detail": "pendiente de implementación"}
