"""Public vendedor endpoints — sin autenticación requerida (login, recupero)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.comercio import Vendedor
from app.services import comercio_password, vendedor_password
from app.services.comercio_auth import DUMMY_HASH, hash_password, verify_password

router = APIRouter()


class LoginRequest(BaseModel):
    usuario: str
    password: str


class VendedorPublic(BaseModel):
    id: int
    nombre: str
    debe_cambiar_password: bool

    model_config = {"from_attributes": True}


class ForgotPasswordRequest(BaseModel):
    usuario: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@router.post("/vendedores/login", response_model=VendedorPublic)
async def login_vendedor(
    body: LoginRequest,
    db: Session = Depends(get_db),
):
    vendedor = db.query(Vendedor).filter(
        Vendedor.usuario == body.usuario.strip().lower()
    ).first()

    # Siempre correr bcrypt para evitar timing attacks, incluso sin password_hash.
    stored = (vendedor.password_hash.encode() if vendedor and vendedor.password_hash else DUMMY_HASH)
    password_ok = verify_password(body.password, stored.decode() if isinstance(stored, bytes) else stored)

    if not vendedor or not vendedor.password_hash or not password_ok:
        raise HTTPException(status_code=401, detail="credenciales_invalidas")

    if not vendedor.activo:
        raise HTTPException(status_code=403, detail="cuenta_inactiva")

    return vendedor


@router.post("/vendedores/forgot-password")
async def forgot_password(
    body: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Mismo patrón anti-enumeración que /public/comercios/forgot-password:
    la protección de fondo (mensaje genérico) vive en la capa Next.js."""
    vendedor = db.query(Vendedor).filter(
        Vendedor.usuario == body.usuario.strip().lower()
    ).first()

    if not vendedor:
        return {"estado": "no_encontrado"}

    if not vendedor.email:
        background_tasks.add_task(vendedor_password.enviar_alerta_sin_email, vendedor)
        return {"estado": "sin_email"}

    token = comercio_password.generar_token_reset()
    vendedor.reset_token_hash = comercio_password.hash_token(token)
    vendedor.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=comercio_password.RESET_TOKEN_TTL_MINUTES
    )
    db.commit()

    background_tasks.add_task(vendedor_password.enviar_mail_reset, vendedor, token)
    return {"estado": "enviado"}


@router.post("/vendedores/reset-password")
async def reset_password(
    body: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    if len(body.password) < 8:
        raise HTTPException(status_code=422, detail="La contraseña debe tener al menos 8 caracteres.")

    token_hash = comercio_password.hash_token(body.token)
    vendedor = db.query(Vendedor).filter(Vendedor.reset_token_hash == token_hash).first()

    now = datetime.now(timezone.utc)
    expira = vendedor.reset_token_expires_at if vendedor else None
    if expira is not None and expira.tzinfo is None:
        expira = expira.replace(tzinfo=timezone.utc)

    if not vendedor or not expira or expira < now:
        raise HTTPException(status_code=400, detail="El link no es válido o expiró. Pedí uno nuevo.")

    vendedor.password_hash = hash_password(body.password)
    vendedor.reset_token_hash = None
    vendedor.reset_token_expires_at = None
    vendedor.debe_cambiar_password = False
    db.commit()

    return {"ok": True}


@router.get("/vendedores/{vendedor_id}/estado")
async def get_estado(
    vendedor_id: int,
    db: Session = Depends(get_db),
):
    """Consulta rápida de estado — usada por el middleware de Next.js para revalidar."""
    vendedor = db.query(Vendedor).filter(Vendedor.id == vendedor_id).first()
    if not vendedor:
        raise HTTPException(status_code=404, detail="not_found")
    return {"activo": bool(vendedor.activo)}
