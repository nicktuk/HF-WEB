"""Servicio para el ciclo post-pedido del canal mayorista: pago, entrega y comisión.

Bloque 1 de la especificación técnica (estado_pago, foto de entrega, entrega
parcial, comisiones). No cablea reserva de stock al confirmar (Bloque 0,
pendiente); la deducción física de stock ocurre recién al entregar, igual
que hoy pasa con las ventas minoristas en SalesService._deduct_stock.
"""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.comercio import (
    Comercio,
    ConfiguracionComercio,
    Comision,
    EstadoHistorial,
    PedidoComercio,
    PedidoComercioEntrega,
    PedidoComercioEntregaItem,
    PedidoComercioItem,
    VentaReportada,
)
from app.models.sale import Sale, SaleItem
from app.models.stock import StockPurchase
from app.services import comisiones

VENTANA_RESERVA_HORAS = 48
RECHAZOS_PARA_ANTICIPADO = 2

# Estados en los que el pedido ya cuenta como venta (ver sincronizar_venta_pedido).
ESTADOS_CON_VENTA = ("confirmado", "preparando", "entrega_parcial", "entregado")
ESTADOS_ENTREGA = ("entrega_parcial", "entregado")
# metodo_pago del pedido -> nombre del método de cobro en ventas/caja
# (el de 'mercadopago_hefa' es el mismo que usa el vendedor en minorista,
# ver vendedor_dashboard.MERCADOPAGO_HEFA_LABEL).
METODO_PAGO_VENTA = {
    "efectivo": "Efectivo",
    "transferencia": "Transferencia",
    "mercadopago_hefa": "Mercado Pago HEFA",
}


def registrar_estado_historial(db: Session, canal: str, referencia_id: int, estado: str) -> None:
    """Anota una transición para el timeline de Mis ventas del vendedor. No
    hace commit — queda dentro de la misma transacción que el cambio de
    estado que la origina."""
    db.add(EstadoHistorial(canal=canal, referencia_id=referencia_id, estado=estado))


def _registrar_entrega(
    pedido: PedidoComercio,
    entregado_por_item: dict[int, int],
    foto_url: str | None,
    origen: str,
) -> None:
    """Anota una entrega con lo que se entregó en ella de cada producto (sólo
    los aumentos; una corrección a la baja no es una entrega). No hace commit."""
    lineas = [(item_id, cant) for item_id, cant in entregado_por_item.items() if cant > 0]
    if not lineas:
        return
    entrega = PedidoComercioEntrega(
        pedido_id=pedido.id,
        fecha=datetime.now(timezone.utc),
        foto_url=foto_url,
        origen=origen,
    )
    entrega.items = [PedidoComercioEntregaItem(pedido_item_id=i, cantidad=c) for i, c in lineas]
    pedido.entregas.append(entrega)


def _get_available_stock(db: Session, product_id: int) -> int:
    from sqlalchemy import func

    qty = (
        db.query(func.coalesce(func.sum(StockPurchase.quantity - StockPurchase.out_quantity), 0))
        .filter(StockPurchase.product_id == product_id)
        .scalar()
    )
    return int(qty or 0)


def _deduct_stock_fifo(db: Session, product_id: int | None, quantity: int) -> None:
    """Descuenta stock físico (FIFO sobre StockPurchase). Sin variantes de color
    ni depósito: los ítems de pedidos mayoristas no las tienen (ver PedidoComercioItem)."""
    if quantity <= 0 or product_id is None:
        return

    available = _get_available_stock(db, product_id)
    if available < quantity:
        raise ValidationError(f"Stock insuficiente para producto {product_id}. Disponible: {available}")

    remaining = quantity
    purchases = (
        db.query(StockPurchase)
        .filter(StockPurchase.product_id == product_id)
        .order_by(StockPurchase.purchase_date.asc(), StockPurchase.id.asc())
        .all()
    )
    for purchase in purchases:
        if remaining <= 0:
            break
        available_in_purchase = purchase.quantity - purchase.out_quantity
        if available_in_purchase <= 0:
            continue
        deduct = min(available_in_purchase, remaining)
        purchase.out_quantity += deduct
        remaining -= deduct

    if remaining > 0:
        raise ValidationError("No se pudo descontar el stock completo")


def _restore_stock_lifo(db: Session, product_id: int | None, quantity: int) -> None:
    """Devuelve stock físico descontado por una entrega que se deshace
    (inverso de _deduct_stock_fifo: libera primero lo de las compras más
    nuevas, igual que SalesService._restore_stock)."""
    if quantity <= 0 or product_id is None:
        return

    remaining = quantity
    purchases = (
        db.query(StockPurchase)
        .filter(StockPurchase.product_id == product_id)
        .order_by(StockPurchase.purchase_date.desc(), StockPurchase.id.desc())
        .all()
    )
    for purchase in purchases:
        if remaining <= 0:
            break
        if purchase.out_quantity <= 0:
            continue
        restore = min(purchase.out_quantity, remaining)
        purchase.out_quantity -= restore
        remaining -= restore

    if remaining > 0:
        raise ValidationError("No se pudo devolver el stock completo")


def _ajustar_entregado(db: Session, item: PedidoComercioItem, nueva_cantidad: int) -> int:
    """Lleva la cantidad entregada de un ítem a `nueva_cantidad` (acotada a
    [0, cantidad]) descontando o devolviendo stock por la diferencia.
    Devuelve el delta aplicado."""
    nueva_cantidad = max(0, min(nueva_cantidad, item.cantidad))
    delta = nueva_cantidad - item.cantidad_entregada
    if delta > 0:
        _deduct_stock_fifo(db, item.producto_id, delta)
    elif delta < 0:
        _restore_stock_lifo(db, item.producto_id, -delta)
    item.cantidad_entregada = nueva_cantidad
    return delta


def _estado_segun_entregas(pedido: PedidoComercio) -> str:
    """Estado del pedido según lo entregado. Si ya no queda nada entregado
    y venía de un estado de entrega, vuelve a 'confirmado'."""
    if all(item.cantidad_entregada >= item.cantidad for item in pedido.items):
        return "entregado"
    if any(item.cantidad_entregada > 0 for item in pedido.items):
        return "entrega_parcial"
    return "confirmado" if pedido.estado in ESTADOS_ENTREGA else pedido.estado


def _verificar_comision_no_liquidada(pedido: PedidoComercio) -> None:
    if pedido.comision is not None and pedido.comision.estado != "pendiente":
        raise ValidationError(
            "La comisión de este pedido ya fue liquidada: no se puede cancelar."
        )


# ─── Venta espejo ─────────────────────────────────────────────────────────────

def venta_de_pedido(db: Session, pedido_id: int) -> Sale | None:
    return db.query(Sale).filter(Sale.pedido_mayorista_id == pedido_id).first()


def lleva_venta(pedido: PedidoComercio) -> bool:
    """Un pedido cuenta como venta desde que se confirma (o se cobra) y
    hasta que se cancela."""
    if pedido.estado == "cancelado":
        return False
    return pedido.estado in ESTADOS_CON_VENTA or pedido.estado_pago == "pagado"


def sincronizar_venta_pedido(db: Session, pedido: PedidoComercio) -> Sale | None:
    """Crea, actualiza o borra la venta espejo del pedido (sales con
    origen='mayorista' y pedido_mayorista_id) para que ventas, caja y
    reportes lo cuenten. La venta copia ítems, precios, lo entregado y lo
    cobrado del pedido, pero:
    - no descuenta ni devuelve stock (eso lo hace el pedido al entregar);
    - no genera comisión minorista ni historial para Mis ventas (el pedido
      ya tiene su comisión mayorista y su propio historial).
    El vendedor es el de la cartera del comercio; si el comercio no tiene
    vendedor asignado no se crea (se crea al asignárselo). No hace commit."""
    venta = venta_de_pedido(db, pedido.id)

    if not lleva_venta(pedido):
        if venta is not None:
            db.delete(venta)
        return None

    comercio = pedido.comercio
    if comercio is None or comercio.vendedor_id is None:
        return venta

    if venta is None:
        venta = Sale(
            origen="mayorista",
            pedido_mayorista_id=pedido.id,
            created_at=pedido.created_at,
            total_amount=0,
            delivered_amount=0,
            paid_amount=0,
        )
        db.add(venta)

    pagado = pedido.estado_pago == "pagado"
    venta.seller_id = comercio.vendedor_id
    venta.customer_name = comercio.nombre_local
    venta.phone = comercio.celular
    venta.email = comercio.email
    venta.notes = f"Pedido de comercio #{pedido.id}"
    venta.payment_method = (
        METODO_PAGO_VENTA.get(pedido.metodo_pago, pedido.metodo_pago) if pagado else None
    )

    # Fecha de la última entrega que incluyó cada ítem (para delivered_at).
    ultima_entrega: dict[int, datetime] = {}
    for entrega in pedido.entregas:
        for ei in entrega.items:
            ultima_entrega[ei.pedido_item_id] = entrega.fecha

    # Los ítems se regeneran completos en cada sincronización: son un
    # reflejo del pedido, no tienen estado propio que preservar.
    for item in list(venta.items):
        venta.items.remove(item)
    ahora = datetime.now(timezone.utc)
    total = Decimal("0")
    entregado = Decimal("0")
    for item in pedido.items:
        subtotal = Decimal(str(item.subtotal))
        completo = item.cantidad > 0 and item.cantidad_entregada >= item.cantidad
        total += subtotal
        if completo:
            entregado += subtotal
        venta.items.append(SaleItem(
            product_id=item.producto_id,
            manual_product_name=None if item.producto_id is not None else item.nombre_producto,
            quantity=item.cantidad,
            delivered_quantity=item.cantidad_entregada,
            is_paid=pagado,
            paid_at=(pedido.fecha_pago or ahora) if pagado else None,
            delivered_at=ultima_entrega.get(item.id, ahora) if completo else None,
            unit_price=item.precio_unitario,
            total_price=subtotal,
            es_oferta=False,
        ))

    venta.total_amount = total
    venta.delivered_amount = entregado
    venta.delivered = bool(pedido.items) and entregado == total
    venta.paid = pagado and bool(pedido.items)
    venta.paid_amount = total if pagado else Decimal("0")
    return venta


def sincronizar_ventas_comercio(db: Session, comercio_id: int) -> None:
    """Resincroniza la venta de todos los pedidos de un comercio (p. ej. al
    cambiarle el vendedor asignado). No hace commit."""
    pedidos = db.query(PedidoComercio).filter(PedidoComercio.comercio_id == comercio_id).all()
    for pedido in pedidos:
        sincronizar_venta_pedido(db, pedido)


def pedidos_sin_venta(db: Session) -> list[PedidoComercio]:
    """Pedidos que deberían tener venta y todavía no la tienen (los
    anteriores a que existiera la venta espejo)."""
    pedidos = (
        db.query(PedidoComercio)
        .outerjoin(Sale, Sale.pedido_mayorista_id == PedidoComercio.id)
        .filter(Sale.id.is_(None), PedidoComercio.estado != "cancelado")
        .order_by(PedidoComercio.id.asc())
        .all()
    )
    return [p for p in pedidos if lleva_venta(p)]


def _pedido_sin_venta_dict(p: PedidoComercio) -> dict:
    comercio = p.comercio
    return {
        "pedido_id": p.id,
        "comercio_local": comercio.nombre_local if comercio else None,
        "estado": p.estado,
        "estado_pago": p.estado_pago,
        "total": float(p.total),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "sin_vendedor": comercio is None or comercio.vendedor_id is None,
    }


def preview_generar_ventas(db: Session) -> dict:
    pedidos = [_pedido_sin_venta_dict(p) for p in pedidos_sin_venta(db)]
    return {
        "a_generar": [p for p in pedidos if not p["sin_vendedor"]],
        "sin_vendedor": [p for p in pedidos if p["sin_vendedor"]],
    }


def generar_ventas_pendientes(db: Session) -> dict:
    """Genera la venta de los pedidos existentes que no la tienen, con la
    fecha original del pedido. No toca stock (lo entregado ya se descontó
    al entregar). Idempotente."""
    generadas: list[int] = []
    sin_vendedor: list[int] = []
    for pedido in pedidos_sin_venta(db):
        if sincronizar_venta_pedido(db, pedido) is None:
            sin_vendedor.append(pedido.id)
        else:
            generadas.append(pedido.id)
    db.commit()
    return {"generadas": generadas, "sin_vendedor": sin_vendedor}


def registrar_pago(db: Session, pedido_id: int, metodo_pago: str) -> PedidoComercio:
    if metodo_pago not in ("efectivo", "transferencia", "mercadopago_hefa"):
        raise ValidationError("metodo_pago debe ser 'efectivo', 'transferencia' o 'mercadopago_hefa'")

    pedido = db.query(PedidoComercio).filter(PedidoComercio.id == pedido_id).first()
    if not pedido:
        raise NotFoundError("PedidoComercio", str(pedido_id))

    if pedido.estado == "cancelado":
        raise ValidationError("El pedido está cancelado.")

    if pedido.estado_pago == "pagado":
        return pedido

    pedido.estado_pago = "pagado"
    pedido.metodo_pago = metodo_pago
    pedido.fecha_pago = datetime.now(timezone.utc)

    sincronizar_comision_pedido(db, pedido)
    sincronizar_venta_pedido(db, pedido)

    db.commit()
    db.refresh(pedido)
    return pedido


def sincronizar_comision_pedido(db: Session, pedido: PedidoComercio) -> Comision | None:
    """Crea (o recalcula, si sigue pendiente) la comisión del pedido,
    atribuida a la cartera del comercio, con la tasa nuevo/recompra propia
    del vendedor si la tiene cargada, si no la general de ConfiguracionComercio
    — pisada por el override manual del pedido si lo hay
    (comision_porcentaje_manual / comision_monto_manual, ver
    services/comisiones.py). Sin vendedor asignado no hay a quién atribuir:
    no se crea comisión. Sólo tiene efecto si el pedido ya está pagado; se
    llama al registrar el pago y también cuando se edita el override manual
    de un pedido ya pagado. Idempotente por el índice único en pedido_id;
    una comisión ya liquidada no se toca acá. Si el comercio es de la
    cartera de un vendedor dueño, no hay comisión. Un pedido cancelado no
    lleva comisión: si tenía una pendiente, se borra."""
    if pedido.estado == "cancelado":
        existente = db.query(Comision).filter(Comision.pedido_id == pedido.id).first()
        if existente is not None and existente.estado == "pendiente":
            db.delete(existente)
        return None

    if pedido.estado_pago != "pagado":
        return None

    comercio = pedido.comercio
    if comercio is None or comercio.vendedor_id is None:
        return None

    existente = db.query(Comision).filter(Comision.pedido_id == pedido.id).first()
    if existente is not None and existente.estado != "pendiente":
        return existente

    if comercio.vendedor is not None and comercio.vendedor.es_dueno:
        # Cartera de un dueño: no lleva comisión (ver CatalogSeller.es_dueno).
        if existente is not None:
            db.delete(existente)
        return None

    hubo_pedido_pagado_antes = (
        db.query(PedidoComercio)
        .filter(
            PedidoComercio.comercio_id == comercio.id,
            PedidoComercio.estado_pago == "pagado",
            PedidoComercio.id != pedido.id,
        )
        .first()
        is not None
    )
    cfg = db.query(ConfiguracionComercio).first()
    vendedor = comercio.vendedor
    if hubo_pedido_pagado_antes:
        porcentaje_default = comisiones.porcentaje_vigente(
            vendedor.comision_mayorista_recompra_porcentaje if vendedor else None,
            cfg.comision_mayorista_recompra_porcentaje if cfg else None,
        )
    else:
        porcentaje_default = comisiones.porcentaje_vigente(
            vendedor.comision_mayorista_nuevo_porcentaje if vendedor else None,
            cfg.comision_mayorista_nuevo_porcentaje if cfg else None,
        )

    base = Decimal(str(pedido.total))
    tasa, monto = comisiones.resolver_tasa_monto(
        base, porcentaje_default, pedido.comision_porcentaje_manual, pedido.comision_monto_manual
    )

    if existente is not None:
        existente.base = base
        existente.tasa = tasa
        existente.monto = monto
        return existente

    comision = Comision(
        vendedor_id=comercio.vendedor_id,
        pedido_id=pedido.id,
        base=base,
        tasa=tasa,
        monto=monto,
        estado="pendiente",
    )
    db.add(comision)
    return comision


def entregar_pedido(
    db: Session,
    pedido_id: int,
    foto_entrega_url: str,
    entregas: dict[int, int],
) -> PedidoComercio:
    """Registra una entrega (total o parcial). `entregas` mapea item_id -> nueva
    cantidad entregada acumulada (no delta). Descuenta stock físico por lo que
    se suma respecto de lo ya entregado, y lo devuelve si se corrige a la baja."""
    if not foto_entrega_url:
        raise ValidationError("La foto de entrega es obligatoria.")

    pedido = (
        db.query(PedidoComercio)
        .filter(PedidoComercio.id == pedido_id)
        .first()
    )
    if not pedido:
        raise NotFoundError("PedidoComercio", str(pedido_id))
    if pedido.estado == "cancelado":
        raise ValidationError("El pedido está cancelado.")

    items_by_id = {item.id: item for item in pedido.items}
    for item_id in entregas:
        if item_id not in items_by_id:
            raise ValidationError(f"El ítem {item_id} no pertenece a este pedido.")

    entregado_ahora: dict[int, int] = {}
    for item in pedido.items:
        nueva_cantidad = entregas.get(item.id, item.cantidad_entregada)
        entregado_ahora[item.id] = _ajustar_entregado(db, item, nueva_cantidad)

    pedido.foto_entrega_url = foto_entrega_url
    _registrar_entrega(pedido, entregado_ahora, foto_entrega_url, "admin")
    _actualizar_estado_por_entregas(db, pedido)
    sincronizar_venta_pedido(db, pedido)

    db.commit()
    db.refresh(pedido)
    return pedido


def _actualizar_estado_por_entregas(db: Session, pedido: PedidoComercio) -> None:
    estado_anterior = pedido.estado
    pedido.estado = _estado_segun_entregas(pedido)
    if pedido.estado != estado_anterior:
        registrar_estado_historial(db, "mayorista", pedido.id, pedido.estado)


def entregar_item_pedido(db: Session, pedido_id: int, item_id: int) -> PedidoComercio:
    """Marca un ítem puntual de un pedido mayorista como entregado por
    completo. Variante de entregar_pedido() sin exigir foto — usada por el
    vendedor desde 'Mis ventas'. Descuenta stock físico por la diferencia
    contra lo ya entregado antes."""
    pedido = db.query(PedidoComercio).filter(PedidoComercio.id == pedido_id).first()
    if not pedido:
        raise NotFoundError("PedidoComercio", str(pedido_id))
    if pedido.estado == "cancelado":
        raise ValidationError("El pedido está cancelado.")

    item = next((i for i in pedido.items if i.id == item_id), None)
    if not item:
        raise NotFoundError("PedidoComercioItem", str(item_id))

    delta = _ajustar_entregado(db, item, item.cantidad)
    _registrar_entrega(pedido, {item.id: delta}, None, "vendedor")
    _actualizar_estado_por_entregas(db, pedido)
    sincronizar_venta_pedido(db, pedido)

    db.commit()
    db.refresh(pedido)
    return pedido


def cambiar_estado(db: Session, pedido_id: int, nuevo: str) -> PedidoComercio:
    """Cambio de estado manual desde el admin. Mantiene el stock coherente
    con lo que el estado dice:
    - 'entregado': entrega todo lo pendiente (descuenta stock).
    - 'entrega_parcial': no se puede elegir a mano (no dice qué cantidades);
      va por entregar_pedido().
    - salir de 'entregado'/'entrega_parcial' hacia un estado anterior o a
      'cancelado': devuelve todo lo entregado.
    Cancelar borra la comisión pendiente y la venta del pedido; con la
    comisión ya liquidada no se puede cancelar."""
    pedido = db.query(PedidoComercio).filter(PedidoComercio.id == pedido_id).first()
    if not pedido:
        raise NotFoundError("PedidoComercio", str(pedido_id))
    if nuevo == pedido.estado:
        return pedido
    if nuevo == "entrega_parcial":
        raise ValidationError(
            "Para una entrega parcial usá 'Entregar' y cargá las cantidades entregadas."
        )
    if nuevo == "cancelado":
        _verificar_comision_no_liquidada(pedido)

    if nuevo == "entregado":
        entregado_ahora = {item.id: _ajustar_entregado(db, item, item.cantidad) for item in pedido.items}
        _registrar_entrega(pedido, entregado_ahora, None, "admin")
    elif pedido.estado in ESTADOS_ENTREGA or nuevo == "cancelado":
        for item in pedido.items:
            _ajustar_entregado(db, item, 0)

    registrar_estado_historial(db, "mayorista", pedido.id, nuevo)
    estado_anterior = pedido.estado
    pedido.estado = nuevo
    if nuevo == "confirmado":
        on_pedido_confirmado(pedido)

    if "cancelado" in (nuevo, estado_anterior):
        sincronizar_comision_pedido(db, pedido)
    sincronizar_venta_pedido(db, pedido)

    db.commit()
    db.refresh(pedido)
    return pedido


def on_pedido_confirmado(pedido: PedidoComercio) -> None:
    """Abre la ventana de reserva de 48hs. Se llama al pasar el pedido a
    'confirmado'; no pisa una ventana ya abierta si se re-confirma."""
    if pedido.fecha_reserva_hasta is None:
        pedido.fecha_reserva_hasta = datetime.utcnow() + timedelta(hours=VENTANA_RESERVA_HORAS)


def autocancelar_vencidos(db: Session) -> list[int]:
    """Cancela los pedidos confirmados y sin pagar cuya ventana de reserva
    venció. Pensado para ser llamado periódicamente (n8n/cron) contra
    POST /admin/comercios/pedidos/autocancelar-vencidos — es idempotente:
    correrlo de nuevo no vuelve a tocar lo que ya está cancelado.

    Al 2º pedido cancelado por vencimiento de un mismo comercio, pasa a
    modalidad_pago='anticipado' (regla de 2 rechazos).
    """
    ahora = datetime.utcnow()
    vencidos = (
        db.query(PedidoComercio)
        .filter(
            PedidoComercio.estado == "confirmado",
            PedidoComercio.estado_pago == "pendiente",
            PedidoComercio.fecha_reserva_hasta.isnot(None),
            PedidoComercio.fecha_reserva_hasta < ahora,
        )
        .all()
    )

    cancelados_ids: list[int] = []
    comercios_afectados: set[int] = set()
    for pedido in vencidos:
        pedido.estado = "cancelado"
        pedido.cancelado_por_vencimiento = True
        registrar_estado_historial(db, "mayorista", pedido.id, "cancelado")
        sincronizar_venta_pedido(db, pedido)
        cancelados_ids.append(pedido.id)
        comercios_afectados.add(pedido.comercio_id)

    for comercio_id in comercios_afectados:
        comercio = db.query(Comercio).filter(Comercio.id == comercio_id).first()
        if comercio is None or comercio.modalidad_pago == "anticipado":
            continue
        rechazos = (
            db.query(PedidoComercio)
            .filter(
                PedidoComercio.comercio_id == comercio_id,
                PedidoComercio.cancelado_por_vencimiento.is_(True),
            )
            .count()
        )
        if rechazos >= RECHAZOS_PARA_ANTICIPADO:
            comercio.modalidad_pago = "anticipado"

    db.commit()
    return cancelados_ids


def calcular_semaforo(
    db: Session,
    comercio: Comercio,
    cfg: ConfiguracionComercio | None = None,
) -> dict:
    """Semáforo de actividad de recompra según días desde el último pedido
    del comercio: verde (< semaforo_dias_amarillo), amarillo (>= amarillo y
    < semaforo_dias_rojo), rojo (>= rojo, o si nunca hizo un pedido)."""
    if cfg is None:
        cfg = db.query(ConfiguracionComercio).first()
    dias_amarillo = cfg.semaforo_dias_amarillo if cfg else 7
    dias_rojo = cfg.semaforo_dias_rojo if cfg else 14

    ultimo_pedido = (
        db.query(PedidoComercio)
        .filter(PedidoComercio.comercio_id == comercio.id)
        .order_by(PedidoComercio.created_at.desc())
        .first()
    )
    if ultimo_pedido is None:
        return {"color": "rojo", "dias_desde_ultimo_pedido": None, "ultimo_pedido_at": None}

    dias = (datetime.utcnow() - ultimo_pedido.created_at).days
    if dias < dias_amarillo:
        color = "verde"
    elif dias < dias_rojo:
        color = "amarillo"
    else:
        color = "rojo"
    return {
        "color": color,
        "dias_desde_ultimo_pedido": dias,
        "ultimo_pedido_at": ultimo_pedido.created_at.isoformat(),
    }


def registrar_venta_reportada(
    db: Session,
    comercio_id: int,
    unidades_vendidas_desde_ultima: int,
    fecha: date,
    producto_id: int | None = None,
) -> VentaReportada:
    """Registra una venta de reventa reportada por el comercio/vendedor.
    Es información complementaria (no participa del cálculo del semáforo,
    que se basa en pedidos_mayoristas)."""
    comercio = db.query(Comercio).filter(Comercio.id == comercio_id).first()
    if not comercio:
        raise NotFoundError("Comercio", str(comercio_id))
    if unidades_vendidas_desde_ultima < 0:
        raise ValidationError("unidades_vendidas_desde_ultima debe ser >= 0")

    venta = VentaReportada(
        comercio_id=comercio_id,
        producto_id=producto_id,
        unidades_vendidas_desde_ultima=unidades_vendidas_desde_ultima,
        fecha=fecha,
    )
    db.add(venta)
    db.commit()
    db.refresh(venta)
    return venta
