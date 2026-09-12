"""Public comercio endpoints — sin autenticación requerida."""
import logging
import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
import bcrypt as _bcrypt
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.models.comercio import Comercio
from app.models.product import ProductImage
from app.config import settings
from app.services import comercio_catalog

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
    rubro: str | None = None
    rubros_interes: list[str] | None = None
    website: str = ""  # honeypot — debe llegar vacío


class LoginRequest(BaseModel):
    usuario: str
    password: str


class ComercioPublic(BaseModel):
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

@router.post("/comercios/solicitud")
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
    comercio = Comercio(
        nombre=body.nombre.strip(),
        apellido=body.apellido.strip(),
        usuario=body.usuario.strip().lower(),
        password_hash=password_hash,
        celular=body.celular,
        email=body.email,
        nombre_local=body.nombre_local.strip(),
        ubicacion_local=body.ubicacion_local.strip(),
        rubro=body.rubro.strip() if body.rubro else None,
        rubros_interes=body.rubros_interes or None,
        estado="pendiente",
    )

    try:
        db.add(comercio)
        db.commit()
        db.refresh(comercio)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ese usuario ya está en uso. Elegí otro.")

    background_tasks.add_task(_webhook_solicitud, comercio)
    return {"ok": True, "comercio_id": comercio.id}


@router.post("/comercios/login", response_model=ComercioPublic)
async def login_comercio(
    body: LoginRequest,
    db: Session = Depends(get_db),
):
    comercio = db.query(Comercio).filter(
        Comercio.usuario == body.usuario.strip().lower()
    ).first()

    # Siempre correr bcrypt para evitar timing attacks
    stored = comercio.password_hash.encode() if comercio else _DUMMY_HASH
    password_ok = _verify_password(body.password, stored.decode() if isinstance(stored, bytes) else stored)

    if not comercio or not password_ok:
        raise HTTPException(status_code=401, detail="credenciales_invalidas")

    if comercio.estado == "pendiente":
        raise HTTPException(status_code=403, detail="cuenta_pendiente")

    if comercio.estado in ("suspendido", "rechazado"):
        raise HTTPException(status_code=403, detail="cuenta_inactiva")

    return comercio


def _imagen_url(db: Session, product_id: int) -> Optional[str]:
    img = db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).order_by(ProductImage.display_order).first()
    return img.url if img else None


@router.get("/comercios/catalogo")
async def get_catalogo_preview(db: Session = Depends(get_db)):
    """Catálogo mayorista sin autenticar: vidriera visual sin precio ni stock.

    Muestra foto, nombre, marca, categoría y cantidad mínima para que un
    comercio nuevo pueda ver qué se vende antes de pedir acceso. No incluye
    precio, costo ni stock — eso requiere iniciar sesión (ver /comercios/catalogo
    en comercios_protected.py). `unidades_por_bulto` no se expone: esa lógica
    está en pausa hasta retomarla.
    """
    cfg = comercio_catalog.get_config(db)
    visibles = comercio_catalog.productos_visibles(db, cfg)
    return {
        "productos": [
            {
                "id": p.id,
                "nombre": p.display_name,
                "marca": p.brand,
                "categoria": p.category,
                "imagen_url": _imagen_url(db, p.id),
                "cantidad_minima": p.cantidad_minima,
            }
            for p, _costo, _stock in visibles
        ],
    }


@router.get("/comercios/{comercio_id}/estado")
async def get_estado(
    comercio_id: int,
    db: Session = Depends(get_db),
):
    """Consulta rápida de estado — usada por el middleware de Next.js para revalidar."""
    comercio = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not comercio:
        raise HTTPException(status_code=404, detail="not_found")
    return {"estado": comercio.estado}


# ── Webhooks ───────────────────────────────────────────────────────────────────

def _webhook_solicitud(comercio: Comercio) -> None:
    url = getattr(settings, "N8N_WEBHOOK_SOLICITUD_COMERCIO", "")
    if not url:
        return
    payload = {
        "evento": "solicitud_comercio",
        "comercio_id": comercio.id,
        "nombre": comercio.nombre,
        "apellido": comercio.apellido,
        "usuario": comercio.usuario,
        "celular": comercio.celular,
        "email": comercio.email,
        "nombre_local": comercio.nombre_local,
        "ubicacion_local": comercio.ubicacion_local,
        "rubro": comercio.rubro,
        "rubros_interes": comercio.rubros_interes,
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
        logger.error("webhook solicitud_comercio falló: %s", exc)
