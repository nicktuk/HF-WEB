"""Admin endpoints for mayoristas: cuentas, vendedores, config y pedidos."""
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.mayorista import (
    Mayorista,
    Vendedor,
    ConfiguracionMayorista,
    PedidoMayorista,
    PedidoMayoristaItem,
)

router = APIRouter()

_ESTADOS_MAYORISTA = {"activo", "rechazado", "suspendido", "pendiente"}
_ESTADOS_PEDIDO = {"recibido", "confirmado", "preparando", "entregado", "cancelado"}


# ─── Mayoristas ────────────────────────────────────────────────────────────────

def _mayorista_dict(m: Mayorista) -> dict:
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


@router.get("/mayoristas")
async def list_mayoristas(
    estado: Optional[str] = Query(None),
    vendedor_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None, max_length=100),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(Mayorista)
    if estado:
        q = q.filter(Mayorista.estado == estado)
    if vendedor_id:
        q = q.filter(Mayorista.vendedor_id == vendedor_id)
    if search:
        term = f"%{search}%"
        q = q.filter(or_(
            Mayorista.nombre.ilike(term),
            Mayorista.apellido.ilike(term),
            Mayorista.usuario.ilike(term),
            Mayorista.nombre_local.ilike(term),
            Mayorista.email.ilike(term),
        ))
    total = q.count()
    items = q.order_by(Mayorista.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "items": [_mayorista_dict(m) for m in items]}


@router.patch("/mayoristas/{mayorista_id}/estado")
async def update_mayorista_estado(
    mayorista_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    m = db.query(Mayorista).filter(Mayorista.id == mayorista_id).first()
    if not m:
        raise HTTPException(404, "Mayorista no encontrado")
    nuevo = body.get("estado")
    if nuevo not in _ESTADOS_MAYORISTA:
        raise HTTPException(400, "Estado inválido")
    m.estado = nuevo
    if nuevo == "activo" and not m.activado_at:
        m.activado_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(m)
    return _mayorista_dict(m)


@router.patch("/mayoristas/{mayorista_id}/vendedor")
async def assign_vendedor_to_mayorista(
    mayorista_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    m = db.query(Mayorista).filter(Mayorista.id == mayorista_id).first()
    if not m:
        raise HTTPException(404, "Mayorista no encontrado")
    vendedor_id = body.get("vendedor_id")
    if vendedor_id is not None:
        v = db.query(Vendedor).filter(Vendedor.id == vendedor_id, Vendedor.activo.is_(True)).first()
        if not v:
            raise HTTPException(404, "Vendedor no encontrado o inactivo")
    m.vendedor_id = vendedor_id
    db.commit()
    db.refresh(m)
    return _mayorista_dict(m)


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

def _config_dict(cfg: ConfiguracionMayorista) -> dict:
    return {
        "descuento_porcentaje": float(cfg.descuento_porcentaje),
        "redondeo": int(cfg.redondeo),
        "monto_minimo_pedido": float(cfg.monto_minimo_pedido),
    }


@router.get("/mayoristas/config")
async def get_mayorista_config(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    cfg = db.query(ConfiguracionMayorista).first()
    if not cfg:
        raise HTTPException(404, "Configuración no encontrada")
    return _config_dict(cfg)


@router.patch("/mayoristas/config")
async def update_mayorista_config(
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    cfg = db.query(ConfiguracionMayorista).first()
    if not cfg:
        raise HTTPException(404, "Configuración no encontrada")
    if "descuento_porcentaje" in body:
        val = float(body["descuento_porcentaje"])
        if not 0 <= val <= 100:
            raise HTTPException(400, "descuento_porcentaje debe estar entre 0 y 100")
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

def _pedido_dict(p: PedidoMayorista, with_items: bool = False) -> dict:
    d: dict = {
        "id": p.id,
        "mayorista_id": p.mayorista_id,
        "mayorista_nombre": f"{p.mayorista.nombre} {p.mayorista.apellido}" if p.mayorista else None,
        "mayorista_local": p.mayorista.nombre_local if p.mayorista else None,
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


@router.get("/mayoristas/pedidos")
async def list_pedidos_mayoristas(
    estado: Optional[str] = Query(None),
    mayorista_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(PedidoMayorista)
    if estado:
        q = q.filter(PedidoMayorista.estado == estado)
    if mayorista_id:
        q = q.filter(PedidoMayorista.mayorista_id == mayorista_id)
    total = q.count()
    items = q.order_by(PedidoMayorista.id.desc()).offset((page - 1) * limit).limit(limit).all()
    return {"total": total, "items": [_pedido_dict(p) for p in items]}


@router.get("/mayoristas/pedidos/{pedido_id}")
async def get_pedido_mayorista(
    pedido_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    p = db.query(PedidoMayorista).filter(PedidoMayorista.id == pedido_id).first()
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    return _pedido_dict(p, with_items=True)


@router.patch("/mayoristas/pedidos/{pedido_id}/estado")
async def update_pedido_estado(
    pedido_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    p = db.query(PedidoMayorista).filter(PedidoMayorista.id == pedido_id).first()
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    nuevo = body.get("estado")
    if nuevo not in _ESTADOS_PEDIDO:
        raise HTTPException(400, "Estado inválido")
    p.estado = nuevo
    db.commit()
    db.refresh(p)
    return _pedido_dict(p)
