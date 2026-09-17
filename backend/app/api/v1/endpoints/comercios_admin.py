"""Admin endpoints for comercios: cuentas, vendedores, config y pedidos."""
from typing import Optional
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.comercio import (
    Comercio,
    Vendedor,
    ConfiguracionComercio,
    DescuentoTramoComercio,
    PedidoComercio,
    PedidoComercioItem,
)
from app.services import comercio_password
from app.services.comercio_auth import hash_password
from app.services import comercio_pedidos
from app.core.exceptions import AppException

router = APIRouter()

_ESTADOS_COMERCIO = {"activo", "rechazado", "suspendido", "pendiente"}
_ESTADOS_PEDIDO = {"recibido", "confirmado", "preparando", "entregado", "entrega_parcial", "cancelado"}


# ─── Comercios ────────────────────────────────────────────────────────────────

def _comercio_dict(m: Comercio, db: Optional[Session] = None) -> dict:
    d = {
        "id": m.id,
        "nombre": m.nombre,
        "apellido": m.apellido,
        "usuario": m.usuario,
        "celular": m.celular,
        "email": m.email,
        "nombre_local": m.nombre_local,
        "ubicacion_local": m.ubicacion_local,
        "rubro": m.rubro,
        "rubros_interes": m.rubros_interes,
        "estado": m.estado,
        "vendedor_id": m.vendedor_id,
        "vendedor_nombre": m.vendedor.nombre if m.vendedor else None,
        "activado_at": m.activado_at.isoformat() if m.activado_at else None,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "debe_cambiar_password": bool(m.debe_cambiar_password),
        "modalidad_pago": m.modalidad_pago,
    }
    if db is not None:
        d["semaforo"] = comercio_pedidos.calcular_semaforo(db, m)
    return d


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
    return {"total": total, "items": [_comercio_dict(m, db) for m in items]}


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


@router.post("/comercios/{comercio_id}/asignar-otp")
async def asignar_otp(
    comercio_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Genera una contraseña temporal (OTP) para un comercio que no puede
    resolver su recupero por mail (sin email registrado). Se devuelve en
    texto plano una sola vez para que el admin se la comunique por WhatsApp;
    el comercio queda forzado a cambiarla en su próximo login."""
    m = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not m:
        raise HTTPException(404, "Comercio no encontrado")

    otp = comercio_password.generar_otp()
    m.password_hash = hash_password(otp)
    m.debe_cambiar_password = True
    m.reset_token_hash = None
    m.reset_token_expires_at = None
    db.commit()
    return {"ok": True, "otp": otp}


# ─── Vendedores ─────────────────────────────────────────────────────────────────

def _vendedor_dict(v: Vendedor) -> dict:
    return {
        "id": v.id,
        "nombre": v.nombre,
        "celular_wa": v.celular_wa,
        "email": v.email,
        "activo": v.activo,
        "usuario": v.usuario,
        "tiene_credenciales": bool(v.usuario and v.password_hash),
        "debe_cambiar_password": bool(v.debe_cambiar_password),
        "catalog_seller_id": v.catalog_seller_id,
        "catalog_seller_nombre": v.catalog_seller.nombre if v.catalog_seller else None,
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
    if "catalog_seller_id" in body:
        catalog_seller_id = body["catalog_seller_id"]
        if catalog_seller_id is not None:
            from app.models.catalog_seller import CatalogSeller
            seller = db.query(CatalogSeller).filter(CatalogSeller.id == catalog_seller_id).first()
            if not seller:
                raise HTTPException(404, "Vendedor de venta minorista no encontrado")
        v.catalog_seller_id = catalog_seller_id
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


@router.post("/vendedores/{vendedor_id}/asignar-credenciales")
async def asignar_credenciales_vendedor(
    vendedor_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Asigna (o reasigna) el usuario y una contraseña temporal (OTP) para que
    el vendedor pueda entrar al portal por primera vez. Se devuelve la OTP en
    texto plano una sola vez para que el admin se la comunique por WhatsApp;
    el vendedor queda forzado a cambiarla en su próximo login. Si ya tenía un
    usuario asignado y no se manda uno nuevo, conserva el actual."""
    v = db.query(Vendedor).filter(Vendedor.id == vendedor_id).first()
    if not v:
        raise HTTPException(404, "Vendedor no encontrado")

    usuario = (body.get("usuario") or v.usuario or "").strip().lower()
    if not usuario:
        raise HTTPException(400, "usuario es obligatorio")

    v.usuario = usuario
    otp = comercio_password.generar_otp()
    v.password_hash = hash_password(otp)
    v.debe_cambiar_password = True
    v.reset_token_hash = None
    v.reset_token_expires_at = None

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ese usuario ya está en uso. Elegí otro.")

    return {"ok": True, "usuario": usuario, "otp": otp}


# ─── Configuración ─────────────────────────────────────────────────────────────

def _config_dict(cfg: ConfiguracionComercio) -> dict:
    return {
        "descuento_porcentaje": float(cfg.descuento_porcentaje),
        "redondeo": int(cfg.redondeo),
        "monto_minimo_pedido": float(cfg.monto_minimo_pedido),
        "tipo_markup": cfg.tipo_markup or 'fijo',
        "mostrar_todos_con_stock": bool(cfg.mostrar_todos_con_stock),
        "modo_precio": cfg.modo_precio or 'markup',
        "semaforo_dias_amarillo": int(cfg.semaforo_dias_amarillo),
        "semaforo_dias_rojo": int(cfg.semaforo_dias_rojo),
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
    if "mostrar_todos_con_stock" in body:
        cfg.mostrar_todos_con_stock = bool(body["mostrar_todos_con_stock"])
    if "tipo_markup" in body:
        if body["tipo_markup"] not in ("fijo", "variable"):
            raise HTTPException(400, "tipo_markup debe ser 'fijo' o 'variable'")
        cfg.tipo_markup = body["tipo_markup"]
    if "modo_precio" in body:
        if body["modo_precio"] not in ("markup", "descuento"):
            raise HTTPException(400, "modo_precio debe ser 'markup' o 'descuento'")
        cfg.modo_precio = body["modo_precio"]
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
    if "semaforo_dias_amarillo" in body:
        dias = int(body["semaforo_dias_amarillo"])
        if dias < 1:
            raise HTTPException(400, "semaforo_dias_amarillo debe ser >= 1")
        cfg.semaforo_dias_amarillo = dias
    if "semaforo_dias_rojo" in body:
        dias = int(body["semaforo_dias_rojo"])
        if dias < 1:
            raise HTTPException(400, "semaforo_dias_rojo debe ser >= 1")
        cfg.semaforo_dias_rojo = dias
    if cfg.semaforo_dias_rojo <= cfg.semaforo_dias_amarillo:
        raise HTTPException(400, "semaforo_dias_rojo debe ser mayor que semaforo_dias_amarillo")
    db.commit()
    db.refresh(cfg)
    return _config_dict(cfg)


@router.get("/comercios/config/tramos")
async def get_comercio_tramos(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    tramos = db.query(DescuentoTramoComercio).order_by(DescuentoTramoComercio.cantidad_minima).all()
    return [
        {"id": t.id, "cantidad_minima": t.cantidad_minima, "descuento_porcentaje": float(t.descuento_porcentaje)}
        for t in tramos
    ]


@router.put("/comercios/config/tramos")
async def set_comercio_tramos(
    body: list[dict],
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Reemplaza toda la matriz cantidad/descuento. Se manda la lista completa cada vez."""
    cantidades_vistas: set[int] = set()
    nuevos: list[DescuentoTramoComercio] = []
    for row in body:
        cantidad = int(row.get("cantidad_minima", 0))
        descuento = float(row.get("descuento_porcentaje", 0))
        if cantidad < 1:
            raise HTTPException(400, "cantidad_minima debe ser >= 1")
        if descuento < 0 or descuento > 100:
            raise HTTPException(400, "descuento_porcentaje debe estar entre 0 y 100")
        if cantidad in cantidades_vistas:
            raise HTTPException(400, f"cantidad_minima {cantidad} está repetida")
        cantidades_vistas.add(cantidad)
        nuevos.append(DescuentoTramoComercio(cantidad_minima=cantidad, descuento_porcentaje=descuento))

    db.query(DescuentoTramoComercio).delete()
    db.add_all(nuevos)
    db.commit()

    tramos = db.query(DescuentoTramoComercio).order_by(DescuentoTramoComercio.cantidad_minima).all()
    return [
        {"id": t.id, "cantidad_minima": t.cantidad_minima, "descuento_porcentaje": float(t.descuento_porcentaje)}
        for t in tramos
    ]


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
        "estado_pago": p.estado_pago,
        "metodo_pago": p.metodo_pago,
        "foto_entrega_url": p.foto_entrega_url,
        "fecha_reserva_hasta": p.fecha_reserva_hasta.isoformat() if p.fecha_reserva_hasta else None,
        "cancelado_por_vencimiento": bool(p.cancelado_por_vencimiento),
        "comision": (
            {
                "monto": float(p.comision.monto),
                "tasa": float(p.comision.tasa),
                "estado": p.comision.estado,
            }
            if p.comision else None
        ),
    }
    if with_items:
        d["items"] = [
            {
                "id": i.id,
                "nombre_producto": i.nombre_producto,
                "cantidad": i.cantidad,
                "cantidad_entregada": i.cantidad_entregada,
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
    if nuevo == "confirmado":
        comercio_pedidos.on_pedido_confirmado(p)
    db.commit()
    db.refresh(p)
    return _pedido_dict(p)


@router.post("/comercios/pedidos/{pedido_id}/pago")
async def registrar_pago_pedido(
    pedido_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Registra el pago del pedido (efectivo|transferencia) y dispara el
    cálculo de la comisión del vendedor de la cartera."""
    metodo_pago = body.get("metodo_pago")
    try:
        pedido = comercio_pedidos.registrar_pago(db, pedido_id, metodo_pago)
    except AppException as e:
        raise HTTPException(e.status_code, e.message)
    return _pedido_dict(pedido, with_items=True)


@router.post("/comercios/pedidos/{pedido_id}/entregar")
async def entregar_pedido(
    pedido_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Registra una entrega total o parcial. Body:
    { foto_entrega_url: str, entregas: { "<item_id>": cantidad_entregada_acumulada } }
    La foto es obligatoria. Descuenta stock físico por la diferencia contra
    lo ya entregado antes."""
    foto_entrega_url = body.get("foto_entrega_url")
    entregas_raw = body.get("entregas") or {}
    try:
        entregas = {int(k): int(v) for k, v in entregas_raw.items()}
    except (TypeError, ValueError):
        raise HTTPException(422, "'entregas' debe mapear item_id a cantidad entregada.")

    try:
        pedido = comercio_pedidos.entregar_pedido(db, pedido_id, foto_entrega_url, entregas)
    except AppException as e:
        raise HTTPException(e.status_code, e.message)
    return _pedido_dict(pedido, with_items=True)


@router.post("/comercios/pedidos/autocancelar-vencidos")
async def autocancelar_pedidos_vencidos(
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Cancela los pedidos confirmados y sin pagar cuya ventana de reserva de
    48hs venció, y aplica la regla de 2 rechazos (modalidad_pago=anticipado).
    Idempotente — pensado para que un workflow de n8n (o cualquier scheduler
    externo) lo llame periódicamente; hoy no hay nada en el backend que lo
    dispare solo."""
    cancelados = comercio_pedidos.autocancelar_vencidos(db)
    return {"cancelados": cancelados}


# ─── Semáforo y ventas reportadas ───────────────────────────────────────────────

@router.get("/comercios/{comercio_id}/semaforo")
async def get_comercio_semaforo(
    comercio_id: int,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    m = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not m:
        raise HTTPException(404, "Comercio no encontrado")
    return comercio_pedidos.calcular_semaforo(db, m)


@router.post("/comercios/{comercio_id}/venta-reportada")
async def registrar_venta_reportada(
    comercio_id: int,
    body: dict,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Registra una venta de reventa reportada por el comercio/vendedor
    (información complementaria; no participa del cálculo del semáforo)."""
    try:
        unidades = int(body.get("unidades_vendidas_desde_ultima"))
    except (TypeError, ValueError):
        raise HTTPException(422, "unidades_vendidas_desde_ultima es obligatorio y debe ser un entero.")
    fecha_raw = body.get("fecha")
    try:
        fecha = date.fromisoformat(fecha_raw) if fecha_raw else date.today()
    except ValueError:
        raise HTTPException(422, "fecha debe tener formato YYYY-MM-DD.")
    producto_id = body.get("producto_id")

    try:
        venta = comercio_pedidos.registrar_venta_reportada(
            db, comercio_id, unidades, fecha, producto_id=producto_id,
        )
    except AppException as e:
        raise HTTPException(e.status_code, e.message)
    return {
        "id": venta.id,
        "comercio_id": venta.comercio_id,
        "producto_id": venta.producto_id,
        "unidades_vendidas_desde_ultima": venta.unidades_vendidas_desde_ultima,
        "fecha": venta.fecha.isoformat(),
    }
