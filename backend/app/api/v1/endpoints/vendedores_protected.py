"""Vendedor protected endpoints — requieren JWT de vendedor activo."""
from fastapi import APIRouter, Depends, HTTPException, Header
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.comercio import Vendedor
from app.config import settings
from app.services.comercio_auth import hash_password

router = APIRouter()


def get_vendedor_id(authorization: str = Header(..., alias="Authorization")) -> int:
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise HTTPException(401, "auth_requerida")
        payload = jwt.decode(token, settings.VENDEDOR_JWT_SECRET, algorithms=["HS256"])
        vid = payload.get("vendedor_id")
        if not vid:
            raise HTTPException(401, "token_invalido")
        return int(vid)
    except (JWTError, ValueError, AttributeError):
        raise HTTPException(401, "token_invalido")


@router.get("/info")
async def get_vendedor_info(
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    v = db.query(Vendedor).filter(Vendedor.id == vendedor_id).first()
    if not v:
        raise HTTPException(404, "not_found")
    return {
        "id": v.id,
        "nombre": v.nombre,
        "usuario": v.usuario,
        "email": v.email,
    }


class SetPasswordRequest(BaseModel):
    password: str


@router.post("/set-password")
async def set_password(
    body: SetPasswordRequest,
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    """Cambio de contraseña sin pedir la actual: solo alcanzable con una
    sesión ya autenticada (típicamente tras loguearse con una OTP asignada
    por el admin), lo que ya prueba posesión de la cuenta."""
    if len(body.password) < 8:
        raise HTTPException(422, "La contraseña debe tener al menos 8 caracteres.")

    v = db.query(Vendedor).filter(Vendedor.id == vendedor_id).first()
    if not v:
        raise HTTPException(404, "not_found")

    v.password_hash = hash_password(body.password)
    v.debe_cambiar_password = False
    v.reset_token_hash = None
    v.reset_token_expires_at = None
    db.commit()
    return {"ok": True}
