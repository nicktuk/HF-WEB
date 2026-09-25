"""Liquidación semanal de comisiones de vendedores.

Las comisiones se pagan por semana, de lunes a domingo en hora Argentina.
Una comisión pertenece a la semana de su created_at (que se graba al pagarse
la venta/pedido, ver services/comisiones.py) y queda pendiente mientras no
tenga liquidacion_id. Liquidar una semana crea una LiquidacionComision por
vendedor con todas sus comisiones pendientes de esa semana (o las elegidas)
y, opcionalmente, un Expense por el total para que impacte en el resultado
neto. Si aparecen comisiones de una semana ya liquidada (una venta que se
pagó tarde, un backfill), quedan pendientes en esa semana y se pagan con una
liquidación complementaria. Anular una liquidación devuelve sus comisiones a
pendiente y borra el gasto asociado.

"Pagos anteriores": las comisiones que ya se pagaron por fuera antes de
existir las liquidaciones se registran de una vez hasta una fecha de corte
(un domingo), como liquidaciones históricas por vendedor y semana y sin
gasto, para no duplicar en el resultado neto lo que ya se pagó.
"""
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session, selectinload

from app.core.exceptions import NotFoundError, ValidationError
from app.models.catalog_seller import CatalogSeller
from app.models.comercio import Comision, LiquidacionComision
from app.models.expense import Expense
from app.services.comisiones import (
    comision_dict,
    hoy_ar,
    lunes_de,
    rango_utc,
    semana_de,
)


def _semana_info(lunes: date) -> dict:
    domingo = lunes + timedelta(days=6)
    hoy = hoy_ar()
    return {
        "semana_desde": lunes.isoformat(),
        "semana_hasta": domingo.isoformat(),
        "cerrada": domingo < hoy,
        "en_curso": lunes <= hoy <= domingo,
    }


def _validar_lunes(semana_desde: date) -> None:
    if semana_desde.weekday() != 0:
        raise ValidationError("semana_desde tiene que ser un lunes.", field="semana_desde")


def liquidacion_dict(l: LiquidacionComision, con_comisiones: bool = False) -> dict:
    d = {
        "id": l.id,
        "vendedor_id": l.vendedor_id,
        "vendedor_nombre": l.vendedor.nombre if l.vendedor else None,
        "semana_desde": l.semana_desde.isoformat(),
        "semana_hasta": l.semana_hasta.isoformat(),
        "fecha_pago": l.fecha_pago.isoformat(),
        "total": float(l.total),
        "medio_pago": l.medio_pago,
        "notas": l.notas,
        "estado": l.estado,
        "expense_id": l.expense_id,
        "historica": bool(l.historica),
        "cantidad": len(l.comisiones),
        "created_at": l.created_at.isoformat() if l.created_at else None,
    }
    if con_comisiones:
        d["comisiones"] = [comision_dict(c) for c in sorted(l.comisiones, key=lambda c: c.id)]
    return d


def _pendientes_query(db: Session, lunes: date):
    inicio, fin = rango_utc(lunes, lunes + timedelta(days=6))
    return db.query(Comision).filter(
        Comision.liquidacion_id.is_(None),
        Comision.created_at >= inicio,
        Comision.created_at < fin,
    )


def listar_semanas(db: Session, cantidad: int = 8) -> list[dict]:
    """Últimas `cantidad` semanas (incluida la en curso) más cualquier semana
    anterior que todavía tenga comisiones pendientes, con el total pendiente
    y el liquidado de cada una. Ordenadas de la más nueva a la más vieja."""
    lunes_actual = lunes_de(hoy_ar())
    semanas = {lunes_actual - timedelta(weeks=i) for i in range(cantidad)}

    pendiente_total: dict[date, Decimal] = defaultdict(Decimal)
    pendiente_cantidad: dict[date, int] = defaultdict(int)
    for created_at, monto in (
        db.query(Comision.created_at, Comision.monto).filter(Comision.liquidacion_id.is_(None)).all()
    ):
        lunes = semana_de(created_at)[0]
        pendiente_total[lunes] += monto
        pendiente_cantidad[lunes] += 1
    semanas |= set(pendiente_total)

    desde = min(semanas)
    liquidado_total: dict[date, Decimal] = defaultdict(Decimal)
    for semana_desde, total in (
        db.query(LiquidacionComision.semana_desde, LiquidacionComision.total)
        .filter(LiquidacionComision.estado == "confirmada", LiquidacionComision.semana_desde >= desde)
        .all()
    ):
        liquidado_total[semana_desde] += total
    semanas |= set(liquidado_total)

    return [
        {
            **_semana_info(lunes),
            "pendiente_total": float(pendiente_total[lunes]),
            "pendiente_cantidad": pendiente_cantidad[lunes],
            "liquidado_total": float(liquidado_total[lunes]),
        }
        for lunes in sorted(semanas, reverse=True)
    ]


def resumen_semana(db: Session, semana_desde: date) -> dict:
    """Comisiones pendientes de una semana agrupadas por vendedor, más las
    liquidaciones confirmadas que ya tiene esa semana."""
    _validar_lunes(semana_desde)
    pendientes = (
        _pendientes_query(db, semana_desde)
        .options(selectinload(Comision.vendedor))
        .order_by(Comision.vendedor_id, Comision.created_at, Comision.id)
        .all()
    )

    por_vendedor: dict[int, dict] = {}
    for c in pendientes:
        v = por_vendedor.get(c.vendedor_id)
        if v is None:
            v = por_vendedor[c.vendedor_id] = {
                "vendedor_id": c.vendedor_id,
                "vendedor_nombre": c.vendedor.nombre if c.vendedor else None,
                "cantidad": 0,
                "total_mayorista": 0.0,
                "total_minorista": 0.0,
                "total": 0.0,
                "comisiones": [],
            }
        monto = float(c.monto)
        v["cantidad"] += 1
        v["total"] += monto
        v["total_mayorista" if c.pedido_id is not None else "total_minorista"] += monto
        v["comisiones"].append(comision_dict(c))

    liquidaciones = (
        db.query(LiquidacionComision)
        .options(selectinload(LiquidacionComision.vendedor), selectinload(LiquidacionComision.comisiones))
        .filter(
            LiquidacionComision.semana_desde == semana_desde,
            LiquidacionComision.estado == "confirmada",
        )
        .order_by(LiquidacionComision.id)
        .all()
    )

    vendedores = sorted(por_vendedor.values(), key=lambda v: v["total"], reverse=True)
    return {
        **_semana_info(semana_desde),
        "vendedores": vendedores,
        "total_pendiente": sum(v["total"] for v in vendedores),
        "liquidaciones": [liquidacion_dict(l) for l in liquidaciones],
        "total_liquidado": sum(float(l.total) for l in liquidaciones),
    }


def liquidar_semana(
    db: Session,
    semana_desde: date,
    vendedores: list[dict],
    fecha_pago: date | None = None,
    medio_pago: str | None = None,
    notas: str | None = None,
    registrar_gasto: bool = True,
) -> list[dict]:
    """Crea una liquidación por vendedor para la semana dada, todo en una
    sola transacción. Cada item de `vendedores` es {vendedor_id,
    comision_ids?}: sin comision_ids se liquidan todas sus pendientes de la
    semana; con comision_ids, sólo esas (tienen que estar pendientes, ser de
    ese vendedor y de esa semana). Un vendedor sin nada pendiente se saltea."""
    _validar_lunes(semana_desde)
    info = _semana_info(semana_desde)
    if not info["cerrada"]:
        raise ValidationError("La semana todavía no terminó: se puede liquidar a partir del lunes siguiente.")
    if not vendedores:
        raise ValidationError("No se eligió ningún vendedor.")

    vendedor_ids = [int(v["vendedor_id"]) for v in vendedores]
    if len(set(vendedor_ids)) != len(vendedor_ids):
        raise ValidationError("Hay vendedores repetidos en la liquidación.")

    fecha_pago = fecha_pago or hoy_ar()
    semana_hasta = semana_desde + timedelta(days=6)
    creadas: list[LiquidacionComision] = []

    for item in vendedores:
        vendedor_id = int(item["vendedor_id"])
        vendedor = db.query(CatalogSeller).filter(CatalogSeller.id == vendedor_id).first()
        if vendedor is None:
            raise NotFoundError("Vendedor", str(vendedor_id))

        pendientes = (
            _pendientes_query(db, semana_desde)
            .filter(Comision.vendedor_id == vendedor_id)
            .with_for_update()
            .all()
        )
        comision_ids = item.get("comision_ids")
        if comision_ids is not None:
            pedidas = {int(i) for i in comision_ids}
            disponibles = {c.id for c in pendientes}
            faltantes = pedidas - disponibles
            if faltantes:
                raise ValidationError(
                    f"Las comisiones {', '.join(str(i) for i in sorted(faltantes))} no están pendientes "
                    f"en esa semana para {vendedor.nombre}."
                )
            pendientes = [c for c in pendientes if c.id in pedidas]
        if not pendientes:
            continue

        total = sum((c.monto for c in pendientes), Decimal("0"))
        liquidacion = LiquidacionComision(
            vendedor_id=vendedor_id,
            semana_desde=semana_desde,
            semana_hasta=semana_hasta,
            fecha_pago=fecha_pago,
            total=total,
            medio_pago=medio_pago or None,
            notas=notas or None,
            estado="confirmada",
        )
        if registrar_gasto:
            liquidacion.expense = Expense(
                date=fecha_pago,
                description=(
                    f"Comisiones {vendedor.nombre} — semana "
                    f"{semana_desde.strftime('%d/%m')} al {semana_hasta.strftime('%d/%m/%Y')}"
                ),
                payment_method=medio_pago or None,
                amount=total,
                notes=notas or None,
            )
        db.add(liquidacion)
        for c in pendientes:
            c.liquidacion = liquidacion
            c.estado = "liquidada"
        creadas.append(liquidacion)

    if not creadas:
        raise ValidationError("No hay comisiones pendientes para liquidar en esa semana.")

    db.commit()
    for l in creadas:
        db.refresh(l)
    return [liquidacion_dict(l) for l in creadas]


def listar_liquidaciones(
    db: Session,
    vendedor_id: int | None = None,
    semana_desde: date | None = None,
    incluir_anuladas: bool = False,
    limit: int = 200,
) -> list[dict]:
    q = db.query(LiquidacionComision).options(
        selectinload(LiquidacionComision.vendedor), selectinload(LiquidacionComision.comisiones)
    )
    if vendedor_id is not None:
        q = q.filter(LiquidacionComision.vendedor_id == vendedor_id)
    if semana_desde is not None:
        q = q.filter(LiquidacionComision.semana_desde == semana_desde)
    if not incluir_anuladas:
        q = q.filter(LiquidacionComision.estado == "confirmada")
    liquidaciones = (
        q.order_by(LiquidacionComision.semana_desde.desc(), LiquidacionComision.id.desc()).limit(limit).all()
    )
    return [liquidacion_dict(l) for l in liquidaciones]


def obtener_liquidacion(db: Session, liquidacion_id: int) -> dict:
    l = db.query(LiquidacionComision).filter(LiquidacionComision.id == liquidacion_id).first()
    if l is None:
        raise NotFoundError("Liquidacion", str(liquidacion_id))
    return liquidacion_dict(l, con_comisiones=True)


def anular_liquidacion(db: Session, liquidacion_id: int) -> dict:
    """Devuelve las comisiones a pendiente (vuelven a aparecer en su semana)
    y borra el gasto que se había registrado, si había uno."""
    l = db.query(LiquidacionComision).filter(LiquidacionComision.id == liquidacion_id).first()
    if l is None:
        raise NotFoundError("Liquidacion", str(liquidacion_id))
    if l.estado == "anulada":
        raise ValidationError("La liquidación ya estaba anulada.")

    for c in list(l.comisiones):
        c.liquidacion = None
        c.estado = "pendiente"
    if l.expense is not None:
        db.delete(l.expense)
        l.expense = None
    l.estado = "anulada"
    db.commit()
    db.refresh(l)
    return liquidacion_dict(l)


def resumen_vendedor(db: Session, vendedor_id: int, limit: int = 26) -> dict:
    """Para el portal del vendedor: lo que lleva generado en la semana en
    curso y sus últimas liquidaciones cobradas."""
    lunes_actual = lunes_de(hoy_ar())
    en_curso = (
        _pendientes_query(db, lunes_actual)
        .filter(Comision.vendedor_id == vendedor_id)
        .all()
    )
    return {
        "semana_en_curso": {
            **_semana_info(lunes_actual),
            "cantidad": len(en_curso),
            "total": float(sum((c.monto for c in en_curso), Decimal("0"))),
        },
        "liquidaciones": listar_liquidaciones(db, vendedor_id=vendedor_id, limit=limit),
    }


# ─── Pagos anteriores (liquidaciones históricas) ────────────────────────────

NOTA_PAGO_ANTERIOR = "Pagado antes de existir las liquidaciones semanales"


def _validar_corte(hasta: date) -> None:
    if hasta.weekday() != 6:
        raise ValidationError("La fecha de corte tiene que ser un domingo.", field="hasta")
    if hasta >= hoy_ar():
        raise ValidationError("La fecha de corte tiene que ser un domingo que ya pasó.", field="hasta")


def _pendientes_hasta(db: Session, hasta: date):
    """Comisiones sin liquidar generadas hasta el domingo `hasta` inclusive,
    sin contar las de vendedores dueños."""
    _, fin = rango_utc(hasta, hasta)
    return (
        db.query(Comision)
        .join(CatalogSeller, CatalogSeller.id == Comision.vendedor_id)
        .filter(
            Comision.liquidacion_id.is_(None),
            Comision.created_at < fin,
            CatalogSeller.es_dueno.is_(False),
        )
    )


def _agrupar(comisiones: list[Comision]) -> dict[tuple[int, date], list[Comision]]:
    grupos: dict[tuple[int, date], list[Comision]] = defaultdict(list)
    for c in comisiones:
        grupos[(c.vendedor_id, semana_de(c.created_at)[0])].append(c)
    return grupos


def resumen_pagos_anteriores(db: Session, hasta: date) -> dict:
    """Vista previa de registrar_pagos_anteriores: qué se marcaría como pagado."""
    _validar_corte(hasta)
    comisiones = _pendientes_hasta(db, hasta).options(selectinload(Comision.vendedor)).all()

    por_vendedor: dict[int, dict] = {}
    for (vendedor_id, _), lista in _agrupar(comisiones).items():
        v = por_vendedor.get(vendedor_id)
        if v is None:
            vendedor = lista[0].vendedor
            v = por_vendedor[vendedor_id] = {
                "vendedor_id": vendedor_id,
                "vendedor_nombre": vendedor.nombre if vendedor else None,
                "semanas": 0,
                "cantidad": 0,
                "total": 0.0,
            }
        v["semanas"] += 1
        v["cantidad"] += len(lista)
        v["total"] += float(sum((c.monto for c in lista), Decimal("0")))

    vendedores = sorted(por_vendedor.values(), key=lambda v: v["total"], reverse=True)
    return {
        "hasta": hasta.isoformat(),
        "desde": min(semana_de(c.created_at)[0] for c in comisiones).isoformat() if comisiones else None,
        "cantidad": len(comisiones),
        "total": sum(v["total"] for v in vendedores),
        "vendedores": vendedores,
    }


def registrar_pagos_anteriores(db: Session, hasta: date) -> dict:
    """Marca como ya pagadas todas las comisiones pendientes hasta el domingo
    `hasta`: una liquidación histórica por vendedor y semana, con fecha de
    pago el domingo de esa semana y sin gasto asociado. Se anulan como
    cualquier otra liquidación."""
    _validar_corte(hasta)
    comisiones = _pendientes_hasta(db, hasta).with_for_update(of=Comision).all()
    if not comisiones:
        raise ValidationError("No hay comisiones pendientes hasta esa fecha.")

    creadas = 0
    for (vendedor_id, lunes), lista in _agrupar(comisiones).items():
        liquidacion = LiquidacionComision(
            vendedor_id=vendedor_id,
            semana_desde=lunes,
            semana_hasta=lunes + timedelta(days=6),
            fecha_pago=lunes + timedelta(days=6),
            total=sum((c.monto for c in lista), Decimal("0")),
            notas=NOTA_PAGO_ANTERIOR,
            estado="confirmada",
            historica=True,
        )
        db.add(liquidacion)
        for c in lista:
            c.liquidacion = liquidacion
            c.estado = "liquidada"
        creadas += 1

    db.commit()
    return {
        "liquidaciones": creadas,
        "cantidad": len(comisiones),
        "total": float(sum((c.monto for c in comisiones), Decimal("0"))),
    }
