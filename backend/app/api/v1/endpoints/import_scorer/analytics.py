"""Analytics — stub para paso 2, implementación completa en paso 18."""
from fastapi import APIRouter, Depends
from app.core.security import verify_admin

router = APIRouter()


@router.get("")
def get_analytics(_: bool = Depends(verify_admin)):
    return {"detail": "pendiente de implementación"}


@router.get("/calibracion")
def get_calibracion(_: bool = Depends(verify_admin)):
    return {"detail": "pendiente de implementación"}
