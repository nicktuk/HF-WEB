"""Las '4 pantallas del vendedor' (Bloque 4): Mi día, Mi cartera, Catálogo
demo y Mi plata, más la gestión de prospectos y el alta directa de cliente
desde la tablet.

Reutiliza comercio_catalog para precios (misma fuente de verdad que el
catálogo del comerciante) y comercio_pedidos.calcular_semaforo para el
semáforo de recompra — nada de esto duplica lógica ya existente.
"""
from datetime import date

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.comercio import (
    Comercio,
    ConfiguracionComercio,
    Comision,
    EstadoHistorial,
    PedidoComercio,
    PedidoComercioItem,
    Prospecto,
)
from app.models.product_comercio import ProductComercioConfig, ProductComercioImage
from app.models.sale import Sale, SaleItem
from app.services import comercio_catalog, comercio_pedidos, liquidaciones
from app.services import comisiones as comisiones_service

ESTADOS_PROSPECTO = {"interesado", "lo_pienso", "no_va", "convertido"}
MERCADOPAGO_HEFA_LABEL = "Mercado Pago HEFA"


# ─── Mi cartera ─────────────────────────────────────────────────────────────

def get_mi_cartera(db: Session, vendedor_id: int) -> list[dict]:
    cfg = db.query(ConfiguracionComercio).first()
    comercios = (
        db.query(Comercio)
        .filter(Comercio.vendedor_id == vendedor_id, Comercio.estado == "activo")
        .order_by(Comercio.nombre_local)
        .all()
    )
    return [
        {
            "id": c.id,
            "nombre_local": c.nombre_local,
            "nombre": f"{c.nombre} {c.apellido}",
            "celular": c.celular,
            "ubicacion_local": c.ubicacion_local,
            "semaforo": comercio_pedidos.calcular_semaforo(db, c, cfg),
        }
        for c in comercios
    ]


def get_mi_cartera_view(db: Session, vendedor_id: int) -> dict:
    """Cartera completa: clientes activos + prospectos en curso (todavía no
    convertidos ni descartados), para armar una sola vista de tarjetas."""
    prospectos_activos = [
        p for p in listar_prospectos(db, vendedor_id)
        if p["estado"] in ("interesado", "lo_pienso")
    ]
    return {
        "clientes": get_mi_cartera(db, vendedor_id),
        "prospectos": prospectos_activos,
    }


# ─── Mi día ─────────────────────────────────────────────────────────────────

def _entregas_mayoristas_pendientes(db: Session, vendedor_id: int) -> list[dict]:
    pedidos = (
        db.query(PedidoComercio)
        .join(Comercio, Comercio.id == PedidoComercio.comercio_id)
        .filter(
            Comercio.vendedor_id == vendedor_id,
            PedidoComercio.estado.in_(["confirmado", "preparando"]),
        )
        .order_by(PedidoComercio.fecha_reserva_hasta.asc().nulls_last(), PedidoComercio.id.asc())
        .all()
    )
    return [
        {
            "canal": "mayorista",
            "id": p.id,
            "cliente_nombre": p.comercio.nombre_local if p.comercio else None,
            "estado": p.estado,
            "total": float(p.total),
            "fecha_limite": p.fecha_reserva_hasta.isoformat() if p.fecha_reserva_hasta else None,
        }
        for p in pedidos
    ]


def _entregas_minoristas_pendientes(db: Session, vendedor_id: int) -> list[dict]:
    ventas = (
        db.query(Sale)
        .filter(Sale.seller_id == vendedor_id, Sale.delivered.is_(False))
        .order_by(Sale.created_at.asc())
        .all()
    )
    return [
        {
            "canal": "minorista",
            "id": s.id,
            "cliente_nombre": s.customer_name,
            "estado": "entregado_parcial" if float(s.delivered_amount or 0) > 0 else "pendiente",
            "total": float(s.total_amount),
            "fecha_limite": None,
        }
        for s in ventas
    ]


def get_mi_dia(db: Session, vendedor_id: int) -> dict:
    """Recorrido del día: entregas primero (mayoristas y minoristas juntas),
    clientes a reactivar después, prospectos en los huecos (mismo orden que
    indica el manual del vendedor)."""
    entregas_pendientes = (
        _entregas_mayoristas_pendientes(db, vendedor_id)
        + _entregas_minoristas_pendientes(db, vendedor_id)
    )

    cartera = get_mi_cartera(db, vendedor_id)
    reactivar = [c for c in cartera if c["semaforo"]["color"] in ("amarillo", "rojo")]

    # Todos los prospectos activos, no solo los que "vencen hoy" — el manual
    # dice "prospectos en los huecos": es una lista para llenar tiempo libre,
    # no una cola con vencimiento estricto. Los que tienen fecha más próxima
    # aparecen primero; los sin fecha quedan al final para completar huecos.
    prospectos_activos = (
        db.query(Prospecto)
        .filter(
            Prospecto.vendedor_id == vendedor_id,
            Prospecto.estado.in_(["interesado", "lo_pienso"]),
        )
        .order_by(Prospecto.fecha_proximo_contacto.asc().nulls_last())
        .all()
    )

    return {
        "entregas_pendientes": entregas_pendientes,
        "reactivar": reactivar,
        "prospectos": [_prospecto_dict(p) for p in prospectos_activos],
    }


# ─── Mi plata ───────────────────────────────────────────────────────────────

def get_mi_plata(db: Session, vendedor_id: int) -> dict:
    """Comisiones mayoristas agrupadas por comercio (para poder mostrarlas
    plegadas, con el detalle de pedidos al expandir) + comisiones minoristas
    ya generadas (planas, una por venta, y agrupadas por semana con el
    tramo alcanzado de la matriz — ver services/comisiones.py) + ventas
    minoristas pagadas que todavía no tienen comisión generada (las genera
    un admin caso por caso, ver /admin/ventas-minoristas/pendientes-comision)."""
    comisiones = (
        db.query(Comision)
        .filter(Comision.vendedor_id == vendedor_id)
        .order_by(Comision.id.desc())
        .all()
    )

    grupos: dict[int | None, dict] = {}
    comisiones_minoristas = []
    for c in comisiones:
        item = {
            "id": c.id,
            "base": float(c.base),
            "tasa": float(c.tasa),
            "monto": float(c.monto),
            "estado": c.estado,
        }
        if c.pedido_id is not None:
            comercio = c.pedido.comercio if c.pedido else None
            key = comercio.id if comercio else None
            if key not in grupos:
                grupos[key] = {
                    "comercio_id": key,
                    "comercio_nombre": comercio.nombre_local if comercio else "Comercio eliminado",
                    "comisiones": [],
                    "total_pendiente": 0.0,
                    "total_liquidado": 0.0,
                }
            grupos[key]["comisiones"].append({**item, "pedido_id": c.pedido_id})
            if c.estado == "liquidada":
                grupos[key]["total_liquidado"] += float(c.monto)
            else:
                grupos[key]["total_pendiente"] += float(c.monto)
        else:
            comisiones_minoristas.append({
                **item,
                "sale_id": c.sale_id,
                "cliente_nombre": c.sale.customer_name if c.sale else None,
            })

    grupos_lista = sorted(grupos.values(), key=lambda g: g["total_pendiente"], reverse=True)
    total_pendiente = sum(g["total_pendiente"] for g in grupos_lista) + sum(
        c["monto"] for c in comisiones_minoristas if c["estado"] == "pendiente"
    )
    total_liquidado = sum(g["total_liquidado"] for g in grupos_lista) + sum(
        c["monto"] for c in comisiones_minoristas if c["estado"] == "liquidada"
    )

    sale_ids_con_comision = {c.sale_id for c in comisiones if c.sale_id is not None}
    ventas = (
        db.query(Sale)
        .filter(Sale.seller_id == vendedor_id, Sale.paid.is_(True))
        .order_by(Sale.id.desc())
        .limit(50)
        .all()
    )
    ventas_sin_comision = [
        {"id": s.id, "cliente_nombre": s.customer_name, "total": float(s.total_amount)}
        for s in ventas if s.id not in sale_ids_con_comision
    ]

    return {
        "grupos": grupos_lista,
        "comisiones_minoristas": comisiones_minoristas,
        "total_pendiente": total_pendiente,
        "total_liquidado": total_liquidado,
        "ventas_sin_comision": ventas_sin_comision,
        "semanas_minoristas": comisiones_service.semanas_minoristas_vendedor(db, vendedor_id),
        **liquidaciones.resumen_vendedor(db, vendedor_id),
    }


# ─── Mis ventas ─────────────────────────────────────────────────────────────

def _entrega_estado_pedido(estado: str) -> str:
    if estado == "entregado":
        return "completo"
    if estado == "entrega_parcial":
        return "parcial"
    return "pendiente"


def _entrega_estado_venta(s: Sale) -> str:
    if s.delivered:
        return "completo"
    if float(s.delivered_amount or 0) > 0:
        return "parcial"
    return "pendiente"


def _pago_estado_venta(s: Sale) -> str:
    if s.paid:
        return "completo"
    if float(s.paid_amount or 0) > 0:
        return "parcial"
    return "pendiente"


def get_mis_ventas(db: Session, vendedor_id: int) -> dict:
    """Pedidos mayoristas de la cartera + ventas minoristas propias, en una
    sola lista plana (cada item lleva su canal) para que el frontend las
    liste sin agrupar. Entrega y pago van por separado (cada uno puede estar
    'pendiente'/'parcial'/'completo') en vez de un único estado combinado,
    porque una venta puede estar pagada pero no entregada o viceversa."""
    pedidos = (
        db.query(PedidoComercio)
        .join(Comercio, Comercio.id == PedidoComercio.comercio_id)
        .filter(Comercio.vendedor_id == vendedor_id)
        .order_by(PedidoComercio.created_at.desc())
        .all()
    )
    ventas = (
        db.query(Sale)
        .filter(Sale.seller_id == vendedor_id)
        .order_by(Sale.created_at.desc())
        .all()
    )

    items = [
        {
            "canal": "mayorista",
            "id": p.id,
            "cliente_nombre": p.comercio.nombre_local if p.comercio else None,
            "estado": p.estado,
            "cancelado": p.estado == "cancelado",
            "entrega_estado": _entrega_estado_pedido(p.estado),
            "pago_estado": "completo" if p.estado_pago == "pagado" else "pendiente",
            "total": float(p.total),
            "created_at": p.created_at.isoformat(),
        }
        for p in pedidos
    ] + [
        {
            "canal": "minorista",
            "id": s.id,
            "cliente_nombre": s.customer_name,
            "estado": None,
            "cancelado": False,
            "entrega_estado": _entrega_estado_venta(s),
            "pago_estado": _pago_estado_venta(s),
            "total": float(s.total_amount),
            "created_at": s.created_at.isoformat(),
        }
        for s in ventas
    ]
    return {"ventas": items}


def get_historial_venta(db: Session, vendedor_id: int, canal: str, referencia_id: int) -> list[dict]:
    """Timeline de fechas por estado de un pedido/venta puntual. El primer
    punto (recibido/pendiente_pago) se sintetiza a partir de created_at —
    nunca se escribe en estado_historial porque es el estado de arranque,
    no una transición. Valida que la venta sea del vendedor antes de
    devolver nada."""
    if canal == "mayorista":
        pedido = (
            db.query(PedidoComercio)
            .join(Comercio, Comercio.id == PedidoComercio.comercio_id)
            .filter(PedidoComercio.id == referencia_id, Comercio.vendedor_id == vendedor_id)
            .first()
        )
        if not pedido:
            raise NotFoundError("PedidoComercio", str(referencia_id))
        creado_en = pedido.created_at
        estado_inicial = "recibido"
    elif canal == "minorista":
        venta = (
            db.query(Sale)
            .filter(Sale.id == referencia_id, Sale.seller_id == vendedor_id)
            .first()
        )
        if not venta:
            raise NotFoundError("Sale", str(referencia_id))
        creado_en = venta.created_at
        estado_inicial = "pendiente_pago"
    else:
        raise ValidationError("canal debe ser 'mayorista' o 'minorista'")

    historial = (
        db.query(EstadoHistorial)
        .filter(EstadoHistorial.canal == canal, EstadoHistorial.referencia_id == referencia_id)
        .order_by(EstadoHistorial.fecha.asc(), EstadoHistorial.id.asc())
        .all()
    )
    return [{"estado": estado_inicial, "fecha": creado_en.isoformat()}] + [
        {"estado": h.estado, "fecha": h.fecha.isoformat()} for h in historial
    ]


def _item_dict_pedido(item: PedidoComercioItem) -> dict:
    return {
        "id": item.id,
        "nombre": item.nombre_producto,
        "cantidad": item.cantidad,
        "cantidad_entregada": item.cantidad_entregada,
        "entregado": item.cantidad_entregada >= item.cantidad,
        "precio_unitario": float(item.precio_unitario),
        "subtotal": float(item.subtotal),
    }


def _item_dict_venta(item: SaleItem) -> dict:
    return {
        "id": item.id,
        "nombre": item.product_name,
        "cantidad": item.quantity,
        "cantidad_entregada": item.delivered_quantity or 0,
        "entregado": item.delivered,
        "pagado": item.paid,
        "precio_unitario": float(item.unit_price),
        "subtotal": float(item.total_price),
    }


def get_detalle_venta(db: Session, vendedor_id: int, canal: str, referencia_id: int) -> dict:
    """Ítems de un pedido/venta puntual, para el modal de 'Mis ventas' donde
    el vendedor marca entrega/pago por producto. En mayorista el pago es a
    nivel de todo el pedido (pedidos_mayoristas_items no tiene columna de
    pago por ítem); en minorista sí es por ítem."""
    if canal == "mayorista":
        pedido = (
            db.query(PedidoComercio)
            .join(Comercio, Comercio.id == PedidoComercio.comercio_id)
            .filter(PedidoComercio.id == referencia_id, Comercio.vendedor_id == vendedor_id)
            .first()
        )
        if not pedido:
            raise NotFoundError("PedidoComercio", str(referencia_id))
        return {
            "cancelado": pedido.estado == "cancelado",
            "pago_estado": "completo" if pedido.estado_pago == "pagado" else "pendiente",
            "pago_por_item": False,
            "items": [_item_dict_pedido(i) for i in pedido.items],
        }
    if canal == "minorista":
        venta = (
            db.query(Sale)
            .filter(Sale.id == referencia_id, Sale.seller_id == vendedor_id)
            .first()
        )
        if not venta:
            raise NotFoundError("Sale", str(referencia_id))
        return {
            "cancelado": False,
            "pago_estado": _pago_estado_venta(venta),
            "pago_por_item": True,
            "items": [_item_dict_venta(i) for i in venta.items],
        }
    raise ValidationError("canal debe ser 'mayorista' o 'minorista'")


def marcar_item_entregado(db: Session, vendedor_id: int, canal: str, referencia_id: int, item_id: int) -> dict:
    if canal == "mayorista":
        pedido = (
            db.query(PedidoComercio)
            .join(Comercio, Comercio.id == PedidoComercio.comercio_id)
            .filter(PedidoComercio.id == referencia_id, Comercio.vendedor_id == vendedor_id)
            .first()
        )
        if not pedido:
            raise NotFoundError("PedidoComercio", str(referencia_id))
        if pedido.estado == "cancelado":
            raise ValidationError("El pedido está cancelado.")
        comercio_pedidos.entregar_item_pedido(db, referencia_id, item_id)
    elif canal == "minorista":
        venta = db.query(Sale).filter(Sale.id == referencia_id, Sale.seller_id == vendedor_id).first()
        if not venta:
            raise NotFoundError("Sale", str(referencia_id))
        from app.services.sales import SalesService
        SalesService(db).mark_item_delivered(referencia_id, item_id)
    else:
        raise ValidationError("canal debe ser 'mayorista' o 'minorista'")
    return get_detalle_venta(db, vendedor_id, canal, referencia_id)


def marcar_item_pagado(db: Session, vendedor_id: int, referencia_id: int, item_id: int) -> dict:
    """Sólo canal minorista: en mayorista el pago es de todo el pedido a la
    vez (ver marcar_pedido_pagado)."""
    venta = db.query(Sale).filter(Sale.id == referencia_id, Sale.seller_id == vendedor_id).first()
    if not venta:
        raise NotFoundError("Sale", str(referencia_id))
    from app.services.sales import SalesService
    SalesService(db).mark_item_paid(referencia_id, item_id, MERCADOPAGO_HEFA_LABEL)
    return get_detalle_venta(db, vendedor_id, "minorista", referencia_id)


def marcar_pedido_pagado(db: Session, vendedor_id: int, pedido_id: int) -> dict:
    """Sólo canal mayorista: pago de todo el pedido, siempre atribuido a
    Mercado Pago HEFA (el vendedor cobra con el link/QR de HEFA)."""
    pedido = (
        db.query(PedidoComercio)
        .join(Comercio, Comercio.id == PedidoComercio.comercio_id)
        .filter(PedidoComercio.id == pedido_id, Comercio.vendedor_id == vendedor_id)
        .first()
    )
    if not pedido:
        raise NotFoundError("PedidoComercio", str(pedido_id))
    if pedido.estado == "cancelado":
        raise ValidationError("El pedido está cancelado.")
    comercio_pedidos.registrar_pago(db, pedido_id, "mercadopago_hefa")
    return get_detalle_venta(db, vendedor_id, "mayorista", pedido_id)


# ─── Catálogo demo ──────────────────────────────────────────────────────────

def _imagen_url(db: Session, product_id: int) -> str | None:
    img = (
        db.query(ProductComercioImage)
        .filter(ProductComercioImage.product_id == product_id)
        .order_by(ProductComercioImage.display_order)
        .first()
    )
    return img.url if img else None


def get_catalogo_demo(db: Session) -> list[dict]:
    """Catálogo con precio mayorista, precio de público y ganancia por unidad
    en cada escalón de la matriz de descuento — lo que el vendedor necesita
    para armar la cuenta en voz alta frente al comerciante (Manual del
    Vendedor, Paso 1). Los precios los define HEFA vía la matriz de
    descuento; el vendedor no los edita acá — es intencional (Especificación
    Funcional §2.3: "el vendedor no negocia precio")."""
    cfg = comercio_catalog.get_config(db)
    visibles = comercio_catalog.productos_visibles(db, cfg)
    tramos = comercio_catalog.get_tramos_descuento(db) if cfg.modo_precio == 'descuento' else []

    items = []
    for p, costo, stock, config in visibles:
        override = config.precio_mayorista_override if config else None
        precio_base = comercio_catalog.precio_referencia(costo, override, cfg, p.final_price)
        precio_venta = p.final_price

        escalones = []
        cantidades = sorted({t["cantidad_minima"] for t in tramos}) or [1]
        for cantidad in cantidades:
            precio_u = comercio_catalog.precio_comercio(costo, override, cfg, precio_venta, cantidad, tramos)
            ganancia = (precio_venta - int(precio_u)) if precio_venta is not None else None
            escalones.append({
                "cantidad_minima": cantidad,
                "precio_unitario": int(precio_u),
                "ganancia_unitaria": ganancia,
            })

        items.append({
            "id": p.id,
            "nombre": p.display_name,
            "marca": p.brand,
            "precio_comercio": int(precio_base),
            "precio_venta": precio_venta,
            "ganancia_unitaria": (precio_venta - int(precio_base)) if precio_venta is not None else None,
            "stock": stock,
            "imagen_url": _imagen_url(db, p.id),
            "cantidad_minima": config.cantidad_minima if config else None,
            "escalones": escalones,
        })
    return items


# ─── Prospectos ─────────────────────────────────────────────────────────────

def _prospecto_dict(p: Prospecto) -> dict:
    return {
        "id": p.id,
        "comercio_nombre": p.comercio_nombre,
        "whatsapp": p.whatsapp,
        "direccion": p.direccion,
        "estado": p.estado,
        "fecha_proximo_contacto": p.fecha_proximo_contacto.isoformat() if p.fecha_proximo_contacto else None,
        "notas": p.notas,
        "comercio_id": p.comercio_id,
    }


def listar_prospectos(db: Session, vendedor_id: int) -> list[dict]:
    prospectos = (
        db.query(Prospecto)
        .filter(Prospecto.vendedor_id == vendedor_id)
        .order_by(Prospecto.fecha_proximo_contacto.asc().nulls_last(), Prospecto.id.desc())
        .all()
    )
    return [_prospecto_dict(p) for p in prospectos]


def listar_prospectos_admin(
    db: Session,
    vendedor_id: int | None = None,
    estado: str | None = None,
) -> list[dict]:
    """Vista admin: la cartera de prospección de todos los vendedores junta,
    para ver qué están levantando en la calle sin tener que pedirle a cada
    uno que comparta pantalla."""
    q = db.query(Prospecto)
    if vendedor_id is not None:
        q = q.filter(Prospecto.vendedor_id == vendedor_id)
    if estado is not None:
        q = q.filter(Prospecto.estado == estado)
    prospectos = q.order_by(Prospecto.id.desc()).all()
    return [
        {**_prospecto_dict(p), "vendedor_id": p.vendedor_id, "vendedor_nombre": p.vendedor.nombre if p.vendedor else None}
        for p in prospectos
    ]


def crear_prospecto(
    db: Session,
    vendedor_id: int,
    comercio_nombre: str,
    whatsapp: str | None = None,
    direccion: str | None = None,
    fecha_proximo_contacto: date | None = None,
    notas: str | None = None,
) -> dict:
    if not comercio_nombre.strip():
        raise ValidationError("comercio_nombre es obligatorio")

    p = Prospecto(
        vendedor_id=vendedor_id,
        comercio_nombre=comercio_nombre.strip(),
        whatsapp=(whatsapp or "").strip() or None,
        direccion=direccion,
        estado="interesado",
        fecha_proximo_contacto=fecha_proximo_contacto,
        notas=notas,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _prospecto_dict(p)


def actualizar_prospecto(db: Session, vendedor_id: int, prospecto_id: int, cambios: dict) -> dict:
    p = (
        db.query(Prospecto)
        .filter(Prospecto.id == prospecto_id, Prospecto.vendedor_id == vendedor_id)
        .first()
    )
    if not p:
        raise NotFoundError("Prospecto", str(prospecto_id))

    if "estado" in cambios:
        estado = cambios["estado"]
        if estado not in ESTADOS_PROSPECTO:
            raise ValidationError(f"estado debe ser uno de: {', '.join(sorted(ESTADOS_PROSPECTO))}")
        if p.estado == "convertido":
            raise ValidationError("Un prospecto convertido no cambia de estado.")
        p.estado = estado
    if "fecha_proximo_contacto" in cambios:
        p.fecha_proximo_contacto = cambios["fecha_proximo_contacto"]
    if "notas" in cambios:
        p.notas = cambios["notas"]
    if "direccion" in cambios:
        p.direccion = cambios["direccion"]
    if "whatsapp" in cambios:
        p.whatsapp = (cambios["whatsapp"] or "").strip() or None

    db.commit()
    db.refresh(p)
    return _prospecto_dict(p)


def convertir_prospecto(
    db: Session,
    vendedor_id: int,
    prospecto_id: int,
    datos_comercio: dict,
) -> tuple[Comercio, str]:
    """Da de alta al Comercio real a partir de un prospecto ya visitado. La
    cuenta queda 'pendiente' igual que cualquier alta — la aprueba admin —
    pero ya atribuida a la cartera del vendedor que hizo la prospección."""
    p = (
        db.query(Prospecto)
        .filter(Prospecto.id == prospecto_id, Prospecto.vendedor_id == vendedor_id)
        .first()
    )
    if not p:
        raise NotFoundError("Prospecto", str(prospecto_id))
    if p.estado == "convertido":
        raise ValidationError("Este prospecto ya fue convertido.")

    comercio, otp = _crear_comercio(db, vendedor_id, datos_comercio)

    p.estado = "convertido"
    p.comercio_id = comercio.id
    db.commit()
    db.refresh(comercio)
    return comercio, otp


def _crear_comercio(db: Session, vendedor_id: int, datos: dict) -> tuple[Comercio, str]:
    """Crea el Comercio con una OTP generada en el momento (no le pedimos al
    vendedor que invente una contraseña frente al cliente): coincide con el
    flujo de "dos minutos" del manual. El comercio la cambia en su primer
    login, igual que con la OTP que asigna admin."""
    from app.services import comercio_password
    from app.services.comercio_auth import hash_password

    requeridos = ["nombre", "apellido", "usuario", "nombre_local", "ubicacion_local"]
    faltantes = [c for c in requeridos if not (datos.get(c) or "").strip()]
    if faltantes:
        raise ValidationError(f"Faltan campos obligatorios: {', '.join(faltantes)}")
    if not datos.get("celular") and not datos.get("email"):
        raise ValidationError("Ingresá al menos un celular o email.")

    otp = comercio_password.generar_otp()
    comercio = Comercio(
        nombre=datos["nombre"].strip(),
        apellido=datos["apellido"].strip(),
        usuario=datos["usuario"].strip().lower(),
        password_hash=hash_password(otp),
        debe_cambiar_password=True,
        celular=datos.get("celular"),
        email=datos.get("email"),
        nombre_local=datos["nombre_local"].strip(),
        ubicacion_local=datos["ubicacion_local"].strip(),
        rubro=(datos.get("rubro") or "").strip() or None,
        estado="pendiente",
        vendedor_id=vendedor_id,
    )
    db.add(comercio)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ValidationError("Ese usuario ya está en uso. Elegí otro.")
    db.refresh(comercio)
    return comercio, otp


def crear_cliente_desde_vendedor(db: Session, vendedor_id: int, datos: dict) -> tuple[Comercio, str]:
    """Alta directa desde la tablet, sin pasar por un prospecto previo
    (Especificación Funcional §3: 'la carga el vendedor, en el momento')."""
    return _crear_comercio(db, vendedor_id, datos)
