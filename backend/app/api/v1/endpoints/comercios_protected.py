"""Comercio protected endpoints — requieren JWT de comercio activo."""
import json
import logging
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.product import ProductImage
from app.models.comercio import Comercio, PedidoComercio, PedidoComercioItem
from app.config import settings
from app.services import comercio_catalog
from app.services.comercio_auth import hash_password

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Auth ───────────────────────────────────────────────────────────────────────

def get_comercio_id(authorization: str = Header(..., alias="Authorization")) -> int:
    try:
        scheme, token = authorization.split(" ", 1)
        if scheme.lower() != "bearer":
            raise HTTPException(401, "auth_requerida")
        payload = jwt.decode(token, settings.COMERCIO_JWT_SECRET, algorithms=["HS256"])
        mid = payload.get("comercio_id")
        if not mid:
            raise HTTPException(401, "token_invalido")
        return int(mid)
    except (JWTError, ValueError, AttributeError):
        raise HTTPException(401, "token_invalido")


# ── Helpers ────────────────────────────────────────────────────────────────────

def _imagen_url(db: Session, product_id: int) -> Optional[str]:
    img = db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).order_by(ProductImage.display_order).first()
    return img.url if img else None


def _galeria(db: Session, product_id: int) -> list[dict]:
    imgs = db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).order_by(ProductImage.display_order).all()
    return [{"id": i.id, "url": i.url, "alt_text": i.alt_text} for i in imgs]


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/info")
async def get_comercio_info(
    comercio_id: int = Depends(get_comercio_id),
    db: Session = Depends(get_db),
):
    m = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not m:
        raise HTTPException(404, "not_found")
    return {
        "id": m.id,
        "nombre": m.nombre,
        "apellido": m.apellido,
        "nombre_local": m.nombre_local,
        "ubicacion_local": m.ubicacion_local,
    }


class SetPasswordRequest(BaseModel):
    password: str


@router.post("/set-password")
async def set_password(
    body: SetPasswordRequest,
    comercio_id: int = Depends(get_comercio_id),
    db: Session = Depends(get_db),
):
    """Cambio de contraseña sin pedir la actual: solo alcanzable con una
    sesión ya autenticada (típicamente tras loguearse con una OTP asignada
    por el admin), lo que ya prueba posesión de la cuenta."""
    if len(body.password) < 8:
        raise HTTPException(422, "La contraseña debe tener al menos 8 caracteres.")

    comercio = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not comercio:
        raise HTTPException(404, "not_found")

    comercio.password_hash = hash_password(body.password)
    comercio.debe_cambiar_password = False
    comercio.reset_token_hash = None
    comercio.reset_token_expires_at = None
    db.commit()
    return {"ok": True}


@router.get("/pricing-config")
async def get_pricing_config(
    comercio_id: int = Depends(get_comercio_id),
    db: Session = Depends(get_db),
):
    """Config de precios liviana, para recalcular precios en el carrito sin
    depender de que el comercio haya pasado antes por el catálogo."""
    cfg = comercio_catalog.get_config(db)
    tramos = comercio_catalog.get_tramos_descuento(db) if cfg.modo_precio == 'descuento' else []
    return {
        "modo_precio": cfg.modo_precio,
        "redondeo": int(cfg.redondeo),
        "tramos_descuento": tramos,
        "monto_minimo_pedido": int(cfg.monto_minimo_pedido or 0),
    }


@router.get("/catalogo")
async def get_catalogo(
    comercio_id: int = Depends(get_comercio_id),
    db: Session = Depends(get_db),
):
    cfg = comercio_catalog.get_config(db)
    visibles = comercio_catalog.productos_visibles(db, cfg)
    tramos = comercio_catalog.get_tramos_descuento(db) if cfg.modo_precio == 'descuento' else []

    items = []
    for p, costo, stock in visibles:
        precio_m = comercio_catalog.precio_referencia(costo, p.precio_mayorista_override, cfg, p.final_price)
        items.append({
            "id": p.id,
            "nombre": p.display_name,
            "marca": p.brand,
            "precio_comercio": int(precio_m),
            "precio_venta": p.final_price,
            "stock": stock,
            "is_on_demand": bool(p.is_on_demand),
            "imagen_url": _imagen_url(db, p.id),
            "categoria": p.category,
            "subcategoria": p.subcategory,
            "unidades_por_bulto": p.unidades_por_bulto,
            "cantidad_minima": p.cantidad_minima,
            "is_featured": bool(p.is_featured),
            "is_immediate_delivery": bool(p.is_immediate_delivery),
            "is_best_seller": bool(p.is_best_seller),
        })

    return {
        "productos": items,
        "config": {
            "monto_minimo_pedido": int(cfg.monto_minimo_pedido or 0),
            "descuento_porcentaje": float(cfg.descuento_porcentaje),
            "modo_precio": cfg.modo_precio,
            "redondeo": int(cfg.redondeo),
            "tramos_descuento": tramos,
        },
    }


@router.get("/productos/{producto_id}")
async def get_producto_detalle(
    producto_id: int,
    comercio_id: int = Depends(get_comercio_id),
    db: Session = Depends(get_db),
):
    """Ficha de producto del canal comercios: solo datos concretos, sin
    descripción de marketing ni calificaciones (eso es exclusivo del sitio
    minorista). Reutiliza comercio_catalog.producto_visible para no mostrar
    productos que no estén habilitados en este canal.
    """
    cfg = comercio_catalog.get_config(db)
    resultado = comercio_catalog.producto_visible(db, cfg, producto_id)
    if not resultado:
        raise HTTPException(404, "Producto no encontrado.")

    p, costo, stock = resultado
    precio_m = comercio_catalog.precio_referencia(costo, p.precio_mayorista_override, cfg, p.final_price)
    tramos = comercio_catalog.get_tramos_descuento(db) if cfg.modo_precio == 'descuento' else []

    return {
        "id": p.id,
        "nombre": p.display_name,
        "marca": p.brand,
        "sku": p.codigo_interno if p.mostrar_codigo else p.sku,
        "categoria": p.category,
        "subcategoria": p.subcategory,
        "kit_content": p.kit_content,
        "unidades_por_bulto": p.unidades_por_bulto,
        "cantidad_minima": p.cantidad_minima,
        "precio_comercio": int(precio_m),
        "precio_venta": p.final_price,
        "stock": stock,
        "is_on_demand": bool(p.is_on_demand),
        "video_url": p.video_url,
        "imagenes": _galeria(db, p.id),
        "is_featured": bool(p.is_featured),
        "is_immediate_delivery": bool(p.is_immediate_delivery),
        "is_best_seller": bool(p.is_best_seller),
        "modo_precio": cfg.modo_precio,
        "redondeo": int(cfg.redondeo),
        "tramos_descuento": tramos,
        "override": p.precio_mayorista_override is not None,
    }


# ── Pedidos ────────────────────────────────────────────────────────────────────

class ItemInput(BaseModel):
    producto_id: int
    cantidad: int


class PedidoCreate(BaseModel):
    items: list[ItemInput]
    notas: str = ""


@router.post("/pedidos", status_code=201)
async def crear_pedido(
    body: PedidoCreate,
    comercio_id: int = Depends(get_comercio_id),
    db: Session = Depends(get_db),
):
    if not body.items:
        raise HTTPException(422, "El pedido no tiene items.")

    cfg = comercio_catalog.get_config(db)
    tramos = comercio_catalog.get_tramos_descuento(db) if cfg.modo_precio == 'descuento' else []
    comercio = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not comercio or comercio.estado != "activo":
        raise HTTPException(403, "cuenta_inactiva")

    items_built = []
    total = Decimal("0")

    for inp in body.items:
        if inp.cantidad <= 0:
            continue
        # Reutiliza las mismas reglas de visibilidad del catálogo (producto,
        # costo y stock ya resueltos) — nunca confiar en datos del cliente.
        resultado = comercio_catalog.producto_visible(db, cfg, inp.producto_id)
        if not resultado:
            raise HTTPException(422, f"Producto {inp.producto_id} no disponible.")
        p, costo, stock = resultado

        # Validación por bulto en pausa (se retoma más adelante):
        # if p.unidades_por_bulto and inp.cantidad % p.unidades_por_bulto != 0:
        #     raise HTTPException(422, f"'{p.display_name}' se vende por bultos de {p.unidades_por_bulto} u.")

        if p.cantidad_minima and inp.cantidad < p.cantidad_minima:
            raise HTTPException(422, f"'{p.display_name}' requiere un mínimo de {p.cantidad_minima} u. (pediste {inp.cantidad}).")

        if stock < inp.cantidad and not p.is_on_demand:
            raise HTTPException(422, f"Stock insuficiente para '{p.display_name}'.")

        precio_u = comercio_catalog.precio_comercio(
            costo, p.precio_mayorista_override, cfg, p.final_price, inp.cantidad, tramos,
        )
        subtotal = precio_u * inp.cantidad
        total += subtotal
        items_built.append({"product": p, "cantidad": inp.cantidad, "precio_u": precio_u, "subtotal": subtotal})

    if not items_built:
        raise HTTPException(422, "El pedido no tiene items válidos.")

    minimo = int(cfg.monto_minimo_pedido or 0)
    if minimo > 0 and total < minimo:
        falta = minimo - int(total)
        raise HTTPException(422, f"Monto mínimo ${minimo:,}. Falta ${falta:,}.")

    vendedor = comercio.vendedor
    pedido = PedidoComercio(
        comercio_id=comercio_id,
        vendedor_nombre=vendedor.nombre if vendedor else None,
        vendedor_celular_wa=vendedor.celular_wa if vendedor else None,
        estado="recibido",
        total=total,
        notas=body.notas or None,
    )
    db.add(pedido)
    db.flush()

    for d in items_built:
        db.add(PedidoComercioItem(
            pedido_id=pedido.id,
            producto_id=d["product"].id,
            nombre_producto=d["product"].display_name,
            cantidad=d["cantidad"],
            precio_unitario=d["precio_u"],
            subtotal=d["subtotal"],
        ))

    db.commit()
    db.refresh(pedido)
    _webhook_pedido(pedido, comercio, vendedor, items_built)
    return {"pedido_id": pedido.id}


@router.get("/pedidos")
async def list_pedidos(
    comercio_id: int = Depends(get_comercio_id),
    db: Session = Depends(get_db),
):
    pedidos = (
        db.query(PedidoComercio)
        .filter(PedidoComercio.comercio_id == comercio_id)
        .order_by(PedidoComercio.created_at.desc())
        .all()
    )
    return [
        {
            "id": p.id,
            "estado": p.estado,
            "total": int(p.total),
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in pedidos
    ]


@router.get("/pedidos/{pedido_id}")
async def get_pedido(
    pedido_id: int,
    comercio_id: int = Depends(get_comercio_id),
    db: Session = Depends(get_db),
):
    pedido = db.query(PedidoComercio).filter(
        PedidoComercio.id == pedido_id,
        PedidoComercio.comercio_id == comercio_id,
    ).first()
    if not pedido:
        raise HTTPException(404, "Pedido no encontrado.")

    return {
        "id": pedido.id,
        "estado": pedido.estado,
        "total": int(pedido.total),
        "notas": pedido.notas,
        "created_at": pedido.created_at.isoformat() if pedido.created_at else None,
        "items": [
            {
                "id": i.id,
                "nombre_producto": i.nombre_producto,
                "cantidad": i.cantidad,
                "precio_unitario": int(i.precio_unitario),
                "precio_original": int(i.precio_original) if i.precio_original else None,
                "subtotal": int(i.subtotal),
            }
            for i in pedido.items
        ],
    }


# ── Webhook ────────────────────────────────────────────────────────────────────

def _webhook_pedido(pedido, comercio, vendedor, items_built) -> None:
    url = getattr(settings, "N8N_WEBHOOK_PEDIDO_COMERCIO", "")
    if not url:
        return
    base_url = getattr(settings, "NEXT_PUBLIC_BASE_URL", "")
    payload = {
        "evento": "pedido_comercio",
        "pedido_id": pedido.id,
        "comercio": {
            "id": comercio.id,
            "nombre": f"{comercio.nombre} {comercio.apellido}",
            "nombre_local": comercio.nombre_local,
            "celular": comercio.celular,
            "email": comercio.email,
            "ubicacion_local": comercio.ubicacion_local,
        },
        "vendedor": {
            "nombre": vendedor.nombre if vendedor else None,
            "celular_wa": vendedor.celular_wa if vendedor else None,
        } if vendedor else None,
        "items": [
            {
                "producto": d["product"].display_name,
                "cantidad": d["cantidad"],
                "precio_unitario": int(d["precio_u"]),
                "subtotal": int(d["subtotal"]),
            }
            for d in items_built
        ],
        "total": int(pedido.total),
        "notas": pedido.notas,
        "url_pedido_admin": f"{base_url}/admin/comercios/pedidos/{pedido.id}",
        "fecha": datetime.now(timezone.utc).isoformat(),
    }
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=10)
    except Exception as exc:
        logger.error("webhook pedido_comercio falló: %s", exc)
