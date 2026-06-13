"""Public mayorista endpoints — sin autenticación requerida."""
import logging
import json
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
import bcrypt as _bcrypt
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.models.mayorista import Mayorista
from app.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Hash dummy hardcodeado para timing-safe comparison cuando el usuario no existe.
# Evita inicializar bcrypt en tiempo de import (incompatible con bcrypt>=4.0 + passlib).
_DUMMY_HASH = b"$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW"


def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode()[:72], _bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    try:
        return _bcrypt.checkpw(plain.encode()[:72], hashed.encode())
    except Exception:
        return False


# ── Schemas ────────────────────────────────────────────────────────────────────

class SolicitudCreate(BaseModel):
    nombre: str
    apellido: str
    usuario: str
    password: str
    celular: str | None = None
    email: str | None = None
    nombre_local: str
    ubicacion_local: str
    website: str = ""  # honeypot — debe llegar vacío


class LoginRequest(BaseModel):
    usuario: str
    password: str


class MayoristaPublic(BaseModel):
    id: int
    nombre: str
    apellido: str
    usuario: str
    nombre_local: str
    ubicacion_local: str
    estado: str
    celular: str | None
    email: str | None
    vendedor_id: int | None

    model_config = {"from_attributes": True}


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/mayoristas/solicitud")
async def crear_solicitud(
    body: SolicitudCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    # Honeypot: si tiene valor, devolver 200 falso sin crear nada
    if body.website:
        return {"ok": True}

    if not body.celular and not body.email:
        raise HTTPException(status_code=422, detail="Ingresá al menos un celular o email.")

    password_hash = _hash_password(body.password)
    mayorista = Mayorista(
        nombre=body.nombre.strip(),
        apellido=body.apellido.strip(),
        usuario=body.usuario.strip().lower(),
        password_hash=password_hash,
        celular=body.celular,
        email=body.email,
        nombre_local=body.nombre_local.strip(),
        ubicacion_local=body.ubicacion_local.strip(),
        estado="pendiente",
    )

    try:
        db.add(mayorista)
        db.commit()
        db.refresh(mayorista)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ese usuario ya está en uso. Elegí otro.")

    background_tasks.add_task(_webhook_solicitud, mayorista)
    return {"ok": True, "mayorista_id": mayorista.id}


@router.post("/mayoristas/login", response_model=MayoristaPublic)
async def login_mayorista(
    body: LoginRequest,
    db: Session = Depends(get_db),
):
    mayorista = db.query(Mayorista).filter(
        Mayorista.usuario == body.usuario.strip().lower()
    ).first()

    # Siempre correr bcrypt para evitar timing attacks
    stored = mayorista.password_hash.encode() if mayorista else _DUMMY_HASH
    password_ok = _verify_password(body.password, stored.decode() if isinstance(stored, bytes) else stored)

    if not mayorista or not password_ok:
        raise HTTPException(status_code=401, detail="credenciales_invalidas")

    if mayorista.estado == "pendiente":
        raise HTTPException(status_code=403, detail="cuenta_pendiente")

    if mayorista.estado in ("suspendido", "rechazado"):
        raise HTTPException(status_code=403, detail="cuenta_inactiva")

    return mayorista


@router.get("/mayoristas/{mayorista_id}/estado")
async def get_estado(
    mayorista_id: int,
    db: Session = Depends(get_db),
):
    """Consulta rápida de estado — usada por el middleware de Next.js para revalidar."""
    mayorista = db.query(Mayorista).filter(Mayorista.id == mayorista_id).first()
    if not mayorista:
        raise HTTPException(status_code=404, detail="not_found")
    return {"estado": mayorista.estado}


# ── Webhooks ───────────────────────────────────────────────────────────────────

def _webhook_solicitud(mayorista: Mayorista) -> None:
    url = getattr(settings, "N8N_WEBHOOK_SOLICITUD_MAYORISTA", "")
    if not url:
        return
    payload = {
        "evento": "solicitud_mayorista",
        "mayorista_id": mayorista.id,
        "nombre": mayorista.nombre,
        "apellido": mayorista.apellido,
        "usuario": mayorista.usuario,
        "celular": mayorista.celular,
        "email": mayorista.email,
        "nombre_local": mayorista.nombre_local,
        "ubicacion_local": mayorista.ubicacion_local,
        "fecha": datetime.now(timezone.utc).isoformat(),
    }
    try:
        import urllib.request
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as exc:
        logger.error("webhook solicitud_mayorista falló: %s", exc)
