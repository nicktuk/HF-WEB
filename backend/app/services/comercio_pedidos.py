"""Servicio para el ciclo post-pedido del canal mayorista: pago, entrega y comisión.

Bloque 1 de la especificación técnica (estado_pago, foto de entrega, entrega
parcial, comisiones). No cablea reserva de stock al confirmar (Bloque 0,
pendiente); la deducción física de stock ocurre recién al entregar, igual
que hoy pasa con las ventas minoristas en SalesService._deduct_stock.
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.comercio import Comision, PedidoComercio, PedidoComercioItem
from app.models.stock import StockPurchase

TASA_COMISION_NUEVO = Decimal("0.15")
TASA_COMISION_RECOMPRA = Decimal("0.10")


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

    _calcular_comision(db, pedido)

    db.commit()
    db.refresh(pedido)
    return pedido


def _calcular_comision(db: Session, pedido: PedidoComercio) -> Comision | None:
    """Crea la comisión del pedido, atribuida a la cartera del comercio.
    Sin vendedor asignado no hay a quién atribuir: no se crea comisión.
    Idempotente por el índice único en pedido_id."""
    existente = db.query(Comision).filter(Comision.pedido_id == pedido.id).first()
    if existente:
        return existente

    comercio = pedido.comercio
    if comercio is None or comercio.vendedor_id is None:
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
    tasa = TASA_COMISION_RECOMPRA if hubo_pedido_pagado_antes else TASA_COMISION_NUEVO

    base = Decimal(str(pedido.total))
    monto = (base * tasa).quantize(Decimal("0.01"))

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
    pedido.estado = "entregado" if todo_entregado else ("entrega_parcial" if algo_entregado else pedido.estado)

    db.commit()
    db.refresh(pedido)
    return pedido
