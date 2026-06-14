"""Admin endpoints for comercios: cuentas, vendedores, config y pedidos."""
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.comercio import (
    Comercio,
    Vendedor,
    ConfiguracionComercio,
    PedidoComercio,
    PedidoComercioItem,
)

router = APIRouter()

_ESTADOS_COMERCIO = {"activo", "rechazado", "suspendido", "pendiente"}
_ESTADOS_PEDIDO = {"recibido", "confirmado", "preparando", "entregado", "cancelado"}


# ─── Comercios ────────────────────────────────────────────────────────────────

def _comercio_dict(m: Comercio) -> dict:
    return {
        "id": m.id,
        "nombre": m.nombre,
        "apellido": m.apellido,
        "usuario": m.usuario,
        "celular": m.celular,
        "email": m.email,
        "nombre_local": m.nombre_local,
        "ubicacion_local": m.ubicacion_local,
        "estado": m.estado,
        "vendedor_id": m.vendedor_id,
        "vendedor_nombre": m.vendedor.nombre if m.vendedor else None,
        "activado_at": m.activado_at.isoformat() if m.activado_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }


@router.get("/comercios")
async def list_comercios(
    estado: Optional[str] = Query(None),
    vendedor_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(Comercio)
    if estado:
        q = q.filter(Comercio.estado == estado)
    if vendedor_id:
        q = q.filter(Comercio.vendedor_id == vendedor_id)
    if search:
        term = f"%{search}%"
        q = q.filter(or_(
            Comercio.nombre.ilike(term),
            Comercio.apellido.ilike(term),
            Comercio.usuario.ilike(term),
            Comercio.nombre_local.ilike(term),
            Comercio.email.ilike(term),
        ))
    total = q.count()
    items = q.order_by(Comercio.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "items": [_comercio_dict(m) for m in items]}


@router.patch("/comercios/{comercio_id}/estado")
async def update_comercio_estado(
    comercio_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    m = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not m:
        raise HTTPException(404, "Comercio no encontrado")
    nuevo = body.get("estado")
    if nuevo not in _ESTADOS_COMERCIO:
        raise HTTPException(400, "Estado inválido")
    m.estado = nuevo
    if nuevo == "activo" and not m.activado_at:
        m.activado_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(m)
    return _comercio_dict(m)


@router.patch("/comercios/{comercio_id}/vendedor")
async def assign_vendedor_to_comercio(
    comercio_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    m = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not m:
        raise HTTPException(404, "Comercio no encontrado")
    vendedor_id = body.get("vendedor_id")
    if vendedor_id is not None:
        v = db.query(Vendedor).filter(Vendedor.id == vendedor_id, Vendedor.activo.is_(True)).first()
        if not v:
            raise HTTPException(404, "Vendedor no encontrado o inactivo")
    m.vendedor_id = vendedor_id
    db.commit()
    db.refresh(m)
    return _comercio_dict(m)


# ─── Vendedores ─────────────────────────────────────────────────────────────────

def _vendedor_dict(v: Vendedor) -> dict:
    return {
        "id": v.id,
        "nombre": v.nombre,
        "celular_wa": v.celular_wa,
        "email": v.email,
        "activo": v.activo,
    }


@router.get("/vendedores")
async def list_vendedores(
    activo: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(Vendedor)
    if activo is not None:
        q = q.filter(Vendedor.activo.is_(activo))
    return [_vendedor_dict(v) for v in q.order_by(Vendedor.nombre).all()]


@router.post("/vendedores")
async def create_vendedor(
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    nombre = (body.get("nombre") or "").strip()
    celular_wa = (body.get("celular_wa") or "").strip()
    if not nombre or not celular_wa:
        raise HTTPException(400, "nombre y celular_wa son obligatorios")
    v = Vendedor(nombre=nombre, celular_wa=celular_wa, email=body.get("email") or None, activo=True)
    db.add(v)
    db.commit()
    db.refresh(v)
    return _vendedor_dict(v)


@router.patch("/vendedores/{vendedor_id}")
async def update_vendedor(
    vendedor_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    v = db.query(Vendedor).filter(Vendedor.id == vendedor_id).first()
    if not v:
        raise HTTPException(404, "Vendedor no encontrado")
    if body.get("nombre"):
        v.nombre = body["nombre"].strip()
    if body.get("celular_wa"):
        v.celular_wa = body["celular_wa"].strip()
    if "email" in body:
        v.email = body["email"] or None
    if "activo" in body:
        v.activo = bool(body["activo"])
    db.commit()
    db.refresh(v)
    return _vendedor_dict(v)


@router.delete("/vendedores/{vendedor_id}")
async def deactivate_vendedor(
    vendedor_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    v = db.query(Vendedor).filter(Vendedor.id == vendedor_id).first()
    if not v:
        raise HTTPException(404, "Vendedor no encontrado")
    v.activo = False
    db.commit()
    return {"ok": True}


# ─── Configuración ─────────────────────────────────────────────────────────────

def _config_dict(cfg: ConfiguracionComercio) -> dict:
    return {
        "descuento_porcentaje": float(cfg.descuento_porcentaje),
        "redondeo": int(cfg.redondeo),
        "monto_minimo_pedido": float(cfg.monto_minimo_pedido),
        "tipo_markup": cfg.tipo_markup or 'fijo',
    }


@router.get("/comercios/config")
async def get_comercio_config(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    cfg = db.query(ConfiguracionComercio).first()
    if not cfg:
        raise HTTPException(404, "Configuración no encontrada")
    return _config_dict(cfg)


@router.patch("/comercios/config")
async def update_comercio_config(
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    cfg = db.query(ConfiguracionComercio).first()
    if not cfg:
        raise HTTPException(404, "Configuración no encontrada")
    if "tipo_markup" in body:
        if body["tipo_markup"] not in ("fijo", "variable"):
            raise HTTPException(400, "tipo_markup debe ser 'fijo' o 'variable'")
        cfg.tipo_markup = body["tipo_markup"]
    if "descuento_porcentaje" in body:
        val = float(body["descuento_porcentaje"])
        if val < 0:
            raise HTTPException(400, "descuento_porcentaje debe ser >= 0")
        cfg.descuento_porcentaje = val
    if "redondeo" in body:
        r = int(body["redondeo"])
        if r < 0:
            raise HTTPException(400, "redondeo debe ser >= 0")
        cfg.redondeo = r
    if "monto_minimo_pedido" in body:
        cfg.monto_minimo_pedido = float(body["monto_minimo_pedido"])
    db.commit()
    db.refresh(cfg)
    return _config_dict(cfg)


# ─── Pedidos ───────────────────────────────────────────────────────────────────

def _pedido_dict(p: PedidoComercio, with_items: bool = False) -> dict:
    d: dict = {
        "id": p.id,
        "comercio_id": p.comercio_id,
        "comercio_nombre": f"{p.comercio.nombre} {p.comercio.apellido}" if p.comercio else None,
        "comercio_local": p.comercio.nombre_local if p.comercio else None,
        "vendedor_nombre": p.vendedor_nombre,
        "vendedor_celular_wa": p.vendedor_celular_wa,
        "estado": p.estado,
        "total": float(p.total),
        "notas": p.notas,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
    if with_items:
        d["items"] = [
            {
                "id": i.id,
                "nombre_producto": i.nombre_producto,
                "cantidad": i.cantidad,
                "precio_unitario": float(i.precio_unitario),
                "precio_original": float(i.precio_original) if i.precio_original else None,
                "subtotal": float(i.subtotal),
            }
            for i in p.items
        ]
    return d


@router.get("/comercios/pedidos")
async def list_pedidos_comercios(
    estado: Optional[str] = Query(None),
    comercio_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(PedidoComercio)
    if estado:
        q = q.filter(PedidoComercio.estado == estado)
    if comercio_id:
        q = q.filter(PedidoComercio.comercio_id == comercio_id)
    total = q.count()
    items = q.order_by(PedidoComercio.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "items": [_pedido_dict(p) for p in items]}


@router.get("/comercios/pedidos/{pedido_id}")
async def get_pedido_comercio(
    pedido_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    p = db.query(PedidoComercio).filter(PedidoComercio.id == pedido_id).first()
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    return _pedido_dict(p, with_items=True)


@router.patch("/comercios/pedidos/{pedido_id}/estado")
async def update_pedido_estado(
    pedido_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    p = db.query(PedidoComercio).filter(PedidoComercio.id == pedido_id).first()
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    nuevo = body.get("estado")
    if nuevo not in _ESTADOS_PEDIDO:
        raise HTTPException(400, "Estado inválido")
    p.estado = nuevo
    db.commit()
    db.refresh(p)
    return _pedido_dict(p)
