"""Vendedor protected endpoints — requieren JWT de vendedor activo."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Header
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.comercio import Vendedor
from app.config import settings
from app.core.exceptions import AppException
from app.services.comercio_auth import hash_password
from app.services import vendedor_dashboard

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
    base_url = getattr(settings, "NEXT_PUBLIC_BASE_URL", "")
    return {
        "id": v.id,
        "nombre": v.nombre,
        "usuario": v.usuario,
        "email": v.email,
        "celular_wa": v.celular_wa,
        "link_personal": f"{base_url}/comercios/catalogo?v={v.id}",
        "tiene_venta_minorista_vinculada": bool(v.catalog_seller_id),
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


# ─── Mi día / Mi cartera / Mi plata / Catálogo demo ────────────────────────

@router.get("/mi-dia")
async def get_mi_dia(
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    return vendedor_dashboard.get_mi_dia(db, vendedor_id)


@router.get("/mi-cartera")
async def get_mi_cartera(
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    return vendedor_dashboard.get_mi_cartera_view(db, vendedor_id)


@router.get("/mi-plata")
async def get_mi_plata(
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    return vendedor_dashboard.get_mi_plata(db, vendedor_id)


@router.get("/catalogo-demo")
async def get_catalogo_demo(
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    return {"productos": vendedor_dashboard.get_catalogo_demo(db)}


# ─── Prospectos ─────────────────────────────────────────────────────────────

class ProspectoCreate(BaseModel):
    comercio_nombre: str
    whatsapp: str | None = None
    direccion: str | None = None
    fecha_proximo_contacto: date | None = None
    notas: str | None = None


class ProspectoUpdate(BaseModel):
    estado: str | None = None
    fecha_proximo_contacto: date | None = None
    notas: str | None = None
    direccion: str | None = None
    whatsapp: str | None = None


@router.get("/prospectos")
async def listar_prospectos(
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    return vendedor_dashboard.listar_prospectos(db, vendedor_id)


@router.post("/prospectos")
async def crear_prospecto(
    body: ProspectoCreate,
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    try:
        return vendedor_dashboard.crear_prospecto(
            db, vendedor_id, body.comercio_nombre, body.whatsapp,
            body.direccion, body.fecha_proximo_contacto, body.notas,
        )
    except AppException as e:
        raise HTTPException(e.status_code, e.message)


@router.patch("/prospectos/{prospecto_id}")
async def actualizar_prospecto(
    prospecto_id: int,
    body: ProspectoUpdate,
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    try:
        return vendedor_dashboard.actualizar_prospecto(
            db, vendedor_id, prospecto_id, body.model_dump(exclude_unset=True),
        )
    except AppException as e:
        raise HTTPException(e.status_code, e.message)


class ClienteCreate(BaseModel):
    nombre: str
    apellido: str
    usuario: str
    celular: str | None = None
    email: str | None = None
    nombre_local: str
    ubicacion_local: str
    rubro: str | None = None


@router.post("/prospectos/{prospecto_id}/convertir")
async def convertir_prospecto(
    prospecto_id: int,
    body: ClienteCreate,
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    try:
        comercio, otp = vendedor_dashboard.convertir_prospecto(db, vendedor_id, prospecto_id, body.model_dump())
    except AppException as e:
        raise HTTPException(e.status_code, e.message)
    return {"ok": True, "comercio_id": comercio.id, "otp": otp}


@router.post("/clientes")
async def crear_cliente(
    body: ClienteCreate,
    vendedor_id: int = Depends(get_vendedor_id),
    db: Session = Depends(get_db),
):
    """Alta directa de cliente desde la tablet, sin prospecto previo. La
    cuenta se crea con una OTP generada en el momento (no hace falta que el
    vendedor invente una contraseña frente al cliente)."""
    try:
        comercio, otp = vendedor_dashboard.crear_cliente_desde_vendedor(db, vendedor_id, body.model_dump())
    except AppException as e:
        raise HTTPException(e.status_code, e.message)
    return {"ok": True, "comercio_id": comercio.id, "otp": otp}
