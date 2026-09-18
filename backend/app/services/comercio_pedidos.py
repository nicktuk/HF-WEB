"""Servicio para el ciclo post-pedido del canal mayorista: pago, entrega y comisión.

Bloque 1 de la especificación técnica (estado_pago, foto de entrega, entrega
parcial, comisiones). No cablea reserva de stock al confirmar (Bloque 0,
pendiente); la deducción física de stock ocurre recién al entregar, igual
que hoy pasa con las ventas minoristas en SalesService._deduct_stock.
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.comercio import (
    Comercio,
    ConfiguracionComercio,
    Comision,
    EstadoHistorial,
    PedidoComercio,
    PedidoComercioItem,
    VentaReportada,
)
from app.models.stock import StockPurchase
from app.services import comisiones

VENTANA_RESERVA_HORAS = 48
RECHAZOS_PARA_ANTICIPADO = 2


def registrar_estado_historial(db: Session, canal: str, referencia_id: int, estado: str) -> None:
    """Anota una transición para el timeline de Mis ventas del vendedor. No
    hace commit — queda dentro de la misma transacción que el cambio de
    estado que la origina."""
    db.add(EstadoHistorial(canal=canal, referencia_id=referencia_id, estado=estado))


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


def registrar_pago(db: Session, pedido_id: int, metodo_pago: str) -> PedidoComercio:
    if metodo_pago not in ("efectivo", "transferencia"):
        raise ValidationError("metodo_pago debe ser 'efectivo' o 'transferencia'")

    pedido = db.query(PedidoComercio).filter(PedidoComercio.id == pedido_id).first()
    if not pedido:
        raise NotFoundError("PedidoComercio", str(pedido_id))

    if pedido.estado_pago == "pagado":
        return pedido

    pedido.estado_pago = "pagado"
    pedido.metodo_pago = metodo_pago

    sincronizar_comision_pedido(db, pedido)

    db.commit()
    db.refresh(pedido)
    return pedido


def sincronizar_comision_pedido(db: Session, pedido: PedidoComercio) -> Comision | None:
    """Crea (o recalcula, si sigue pendiente) la comisión del pedido,
    atribuida a la cartera del comercio, con la tasa vigente en
    ConfiguracionComercio (nuevo/recompra) — pisada por el override manual
    del pedido si lo hay (comision_porcentaje_manual / comision_monto_manual,
    ver services/comisiones.py). Sin vendedor asignado no hay a quién
    atribuir: no se crea comisión. Sólo tiene efecto si el pedido ya está
    pagado; se llama al registrar el pago y también cuando se edita el
    override manual de un pedido ya pagado. Idempotente por el índice único
    en pedido_id; una comisión ya liquidada no se toca acá."""
    if pedido.estado_pago != "pagado":
        return None

    comercio = pedido.comercio
    if comercio is None or comercio.vendedor_id is None:
        return None

    existente = db.query(Comision).filter(Comision.pedido_id == pedido.id).first()
    if existente is not None and existente.estado != "pendiente":
        return existente

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
    porcentaje_default = (
        cfg.comision_mayorista_recompra_porcentaje if hubo_pedido_pagado_antes
        else cfg.comision_mayorista_nuevo_porcentaje
    ) if cfg else Decimal("0")

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
    cantidad entregada acumulada (no delta). Descuenta stock físico por la
    diferencia contra lo ya entregado antes."""
    if not foto_entrega_url:
        raise ValidationError("La foto de entrega es obligatoria.")

    pedido = (
        db.query(PedidoComercio)
        .filter(PedidoComercio.id == pedido_id)
        .first()
    )
    if not pedido:
        raise NotFoundError("PedidoComercio", str(pedido_id))

    items_by_id = {item.id: item for item in pedido.items}
    for item_id in entregas:
        if item_id not in items_by_id:
            raise ValidationError(f"El ítem {item_id} no pertenece a este pedido.")

    for item in pedido.items:
        nueva_cantidad = entregas.get(item.id, item.cantidad_entregada)
        nueva_cantidad = max(0, min(nueva_cantidad, item.cantidad))
        delta = nueva_cantidad - item.cantidad_entregada
        if delta > 0:
            _deduct_stock_fifo(db, item.producto_id, delta)
        item.cantidad_entregada = nueva_cantidad

    pedido.foto_entrega_url = foto_entrega_url
    todo_entregado = all(item.cantidad_entregada >= item.cantidad for item in pedido.items)
    algo_entregado = any(item.cantidad_entregada > 0 for item in pedido.items)
    estado_anterior = pedido.estado
    pedido.estado = "entregado" if todo_entregado else ("entrega_parcial" if algo_entregado else pedido.estado)
    if pedido.estado != estado_anterior:
        registrar_estado_historial(db, "mayorista", pedido.id, pedido.estado)

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
