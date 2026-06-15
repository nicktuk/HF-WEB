"""Comercio protected endpoints — requieren JWT de comercio activo."""
import math
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
from sqlalchemy import func

from app.db.session import get_db
from app.models.product import Product, ProductImage
from app.models.comercio import (
    Comercio, ConfiguracionComercio, PedidoComercio, PedidoComercioItem
)
from app.models.stock import StockPurchase
from app.config import settings

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

def _get_config(db: Session) -> ConfiguracionComercio:
    cfg = db.query(ConfiguracionComercio).first()
    if not cfg:
        cfg = ConfiguracionComercio(descuento_porcentaje=25, redondeo=100, monto_minimo_pedido=0)
    return cfg


def _precio_comercio(
    costo: Decimal,
    override: Optional[Decimal],
    cfg: ConfiguracionComercio,
    precio_venta: Optional[int] = None,
) -> Decimal:
    if override is not None:
        return override
    if cfg.tipo_markup == 'variable' and precio_venta is not None:
        # promedio entre precio de compra y precio de venta (= mitad del markup actual)
        precio = (float(costo) + float(precio_venta)) / 2
    else:
        precio = float(costo) * (1 + float(cfg.descuento_porcentaje) / 100)
    if cfg.redondeo > 0:
        precio = math.ceil(precio / cfg.redondeo) * cfg.redondeo
    return Decimal(str(int(precio)))


def _ultimo_precio_compra(db: Session, product_id: int) -> Optional[Decimal]:
    result = db.query(StockPurchase.unit_price).filter(
        StockPurchase.product_id == product_id
    ).order_by(StockPurchase.purchase_date.desc()).first()
    return Decimal(str(result[0])) if result else None


def _stock_total(db: Session, product_id: int) -> int:
    result = db.query(
        func.coalesce(func.sum(StockPurchase.quantity - StockPurchase.out_quantity), 0)
    ).filter(StockPurchase.product_id == product_id).scalar()
    return int(result or 0)


def _imagen_url(db: Session, product_id: int) -> Optional[str]:
    img = db.query(ProductImage).filter(
        ProductImage.product_id == product_id
    ).order_by(ProductImage.display_order).first()
    return img.url if img else None


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


@router.get("/catalogo")
async def get_catalogo(
    comercio_id: int = Depends(get_comercio_id),
    db: Session = Depends(get_db),
):
    cfg = _get_config(db)

    if cfg.mostrar_todos_con_stock:
        products = (
            db.query(Product)
            .filter(Product.enabled == True)
            .order_by(Product.display_order, Product.id)
            .all()
        )
    else:
        products = (
            db.query(Product)
            .filter(Product.enabled == True, Product.es_mayorista == True)
            .order_by(Product.display_order, Product.id)
            .all()
        )

    items = []
    for p in products:
        costo = _ultimo_precio_compra(db, p.id)

        if cfg.mostrar_todos_con_stock:
            if costo is None:
                continue
            stock = _stock_total(db, p.id)
            if stock == 0:
                continue
            precio_venta = p.final_price
            if precio_venta is None:
                continue
            markup = (float(precio_venta) - float(costo)) / float(costo) * 100
            if markup <= 50:
                continue
        else:
            if costo is None:
                costo = p.original_price
            if costo is None:
                continue
            stock = _stock_total(db, p.id)
            if stock == 0 and not p.is_on_demand:
                continue

        precio_m = _precio_comercio(costo, p.precio_mayorista_override, cfg, p.final_price)
        items.append({
            "id": p.id,
            "nombre": p.display_name,
            "precio_comercio": int(precio_m),
            "stock": stock,
            "is_on_demand": bool(p.is_on_demand),
            "imagen_url": _imagen_url(db, p.id),
            "categoria": p.category,
            "subcategoria": p.subcategory,
        })

    return {
        "productos": items,
        "config": {
            "monto_minimo_pedido": int(cfg.monto_minimo_pedido or 0),
            "descuento_porcentaje": float(cfg.descuento_porcentaje),
        },
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

    cfg = _get_config(db)
    comercio = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not comercio or comercio.estado != "activo":
        raise HTTPException(403, "cuenta_inactiva")

    items_built = []
    total = Decimal("0")

    for inp in body.items:
        if inp.cantidad <= 0:
            continue
        p = db.query(Product).filter(
            Product.id == inp.producto_id,
            Product.es_mayorista == True,
            Product.enabled == True,
        ).first()
        if not p:
            raise HTTPException(422, f"Producto {inp.producto_id} no disponible.")

        stock = _stock_total(db, p.id)
        if stock < inp.cantidad and not p.is_on_demand:
            raise HTTPException(422, f"Stock insuficiente para '{p.display_name}'.")

        costo = _ultimo_precio_compra(db, p.id) or p.original_price
        if costo is None:
            raise HTTPException(422, f"Sin precio de compra para '{p.display_name}'.")

        precio_u = _precio_comercio(costo, p.precio_mayorista_override, cfg, p.final_price)
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
