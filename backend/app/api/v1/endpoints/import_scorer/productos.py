"""Endpoints de productos — stub para paso 2, implementación completa en paso 10."""
from fastapi import APIRouter, Depends
from app.core.security import verify_admin

router = APIRouter()


@router.get("")
def list_productos(_: bool = Depends(verify_admin)):
    return {"detail": "pendiente de implementación"}
