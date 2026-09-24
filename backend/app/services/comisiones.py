"""Gestión de comisiones de vendedor, cruzando ambos canales (mayorista vía
pedido_id, minorista vía sale_id — ver Comision en models/comercio.py).

Mayorista: comercio_pedidos.sincronizar_comision_pedido (se dispara al pagar
un pedido, y al editar su override manual) resuelve la tasa en dos pasos:
porcentaje_vigente elige la tasa "base" — la propia del vendedor si la tiene
cargada, si no la general de ConfiguracionComercio — y resolver_tasa_monto le
aplica el override manual puntual del pedido si lo hay.

Minorista: sincronizar_comision_minorista de acá (se dispara cada vez que se
guarda una venta pagada, desde SalesService) calcula por semana (lunes a
domingo, hora Argentina) con la matriz ComisionMinoristaTramo. Cada venta
cae en la semana en que se generó su comisión (= cuando quedó pagada). La
venta semanal total del vendedor — incluidas las ofertas, para que las
empujen — define el tramo; ese % (o el promedio escalonado, si
comision_minorista_escalonada) se aplica a la parte no-oferta de cada venta,
y la parte en oferta (SaleItem.es_oferta) va siempre al % de ofertas. El
override manual de la venta (comision_porcentaje_manual / comision_monto_manual)
sigue ganando sobre la matriz para esa venta, pero su monto suma igual al
volumen de la semana.

Cada venta pagada/editada/borrada recalcula todas las comisiones pendientes
de su semana del vendedor (si pasa de tramo, sube el % de las anteriores
también). Mientras la semana está abierta el resultado es provisorio (así se
le muestra al vendedor); al cerrar el domingo queda el tramo final, que sólo
cambia si se edita una venta de esa semana. Un cambio de la matriz en el
admin recalcula sólo la semana en curso. Una comisión "liquidada" queda fija
hasta que se anule su liquidación.

Las comisiones se pagan por semana (lunes a domingo, hora Argentina): ver
services/liquidaciones.py. Una comisión pertenece a la semana de su
created_at y pasa a "liquidada" sólo a través de una liquidación.
"""
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.exceptions import AppException, NotFoundError, ValidationError
from app.models.comercio import Comision, ComisionMinoristaTramo, ConfiguracionComercio
from app.models.sale import Sale

# Argentina no tiene horario de verano: UTC-3 fijo. created_at se guarda en
# UTC sin zona (ver models/base.py).
AR_OFFSET = timedelta(hours=3)


def hoy_ar() -> date:
    return (datetime.utcnow() - AR_OFFSET).date()


def lunes_de(d: date) -> date:
    return d - timedelta(days=d.weekday())


def rango_utc(desde: date, hasta: date) -> tuple[datetime, datetime]:
    """[inicio, fin) en UTC sin zona para los días desde..hasta (inclusive)
    en hora Argentina, para filtrar contra created_at."""
    inicio = datetime.combine(desde, time()) + AR_OFFSET
    fin = datetime.combine(hasta + timedelta(days=1), time()) + AR_OFFSET
    return inicio, fin

TZ_AR = ZoneInfo("America/Argentina/Buenos_Aires")


def porcentaje_vigente(vendedor_porcentaje: Decimal | None, config_porcentaje: Decimal | None) -> Decimal:
    """Tasa base mayorista antes de cualquier override manual puntual: la
    propia del vendedor si la tiene cargada (CatalogSeller.comision_mayorista_*),
    si no la general configurada en el admin (ConfiguracionComercio)."""
    if vendedor_porcentaje is not None:
        return Decimal(str(vendedor_porcentaje))
    return Decimal(str(config_porcentaje)) if config_porcentaje is not None else Decimal("0")


def resolver_tasa_monto(
    base: Decimal,
    porcentaje_default: Decimal,
    porcentaje_manual: Decimal | None,
    monto_manual: Decimal | None,
) -> tuple[Decimal, Decimal]:
    """Resuelve (tasa, monto) de una comisión a partir de la base de cálculo
    (total de la venta/pedido) y la tasa configurada en el admin, pisada por
    un override manual si lo hay: `monto_manual` gana si está presente (la
    tasa se deriva de vuelta para dejar el registro consistente); si no,
    `porcentaje_manual` reemplaza a `porcentaje_default`."""
    if monto_manual is not None:
        monto = Decimal(str(monto_manual)).quantize(Decimal("0.01"))
        tasa = (monto / base).quantize(Decimal("0.0001")) if base else Decimal("0")
        return tasa, monto

    porcentaje = Decimal(str(porcentaje_manual)) if porcentaje_manual is not None else Decimal(str(porcentaje_default))
    tasa = porcentaje / 100
    monto = (base * tasa).quantize(Decimal("0.01"))
    return tasa, monto


def comision_dict(c: Comision) -> dict:
    canal = "mayorista" if c.pedido_id is not None else "minorista"
    cliente_nombre = None
    if c.pedido and c.pedido.comercio:
        cliente_nombre = c.pedido.comercio.nombre_local
    elif c.sale:
        cliente_nombre = c.sale.customer_name

    return {
        "id": c.id,
        "canal": canal,
        "vendedor_id": c.vendedor_id,
        "vendedor_nombre": c.vendedor.nombre if c.vendedor else None,
        "pedido_id": c.pedido_id,
        "sale_id": c.sale_id,
        "cliente_nombre": cliente_nombre,
        "base": float(c.base),
        "base_oferta": float(c.base_oferta or 0),
        "tasa": float(c.tasa),
        "monto": float(c.monto),
        "estado": c.estado,
        "fecha": c.created_at.isoformat() if c.created_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "semana_desde": semana_de(c.created_at)[0].isoformat() if c.created_at else None,
        "liquidacion_id": c.liquidacion_id,
    }


def listar_comisiones(
    db: Session,
    vendedor_id: int | None = None,
    estado: str | None = None,
    canal: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
) -> list[dict]:
    q = db.query(Comision)
    if desde is not None:
        q = q.filter(Comision.created_at >= rango_utc(desde, desde)[0])
    if hasta is not None:
        q = q.filter(Comision.created_at < rango_utc(hasta, hasta)[1])
    if vendedor_id is not None:
        q = q.filter(Comision.vendedor_id == vendedor_id)
    if estado is not None:
        q = q.filter(Comision.estado == estado)
    if canal == "mayorista":
        q = q.filter(Comision.pedido_id.isnot(None))
    elif canal == "minorista":
        q = q.filter(Comision.sale_id.isnot(None))
    comisiones = q.order_by(Comision.id.desc()).all()
    return [comision_dict(c) for c in comisiones]


def listar_ventas_minoristas_pendientes_comision(db: Session) -> list[dict]:
    """Ventas minoristas pagadas que todavía no tienen una comisión generada.
    Desde que sincronizar_comision_minorista corre automáticamente al pagar
    una venta, esta lista debería quedar vacía salvo para ventas que ya
    estaban pagadas antes de que ese trigger existiera — es la vía de
    backfill/generación manual para esos casos puntuales."""
    ventas = (
        db.query(Sale)
        .outerjoin(Comision, Comision.sale_id == Sale.id)
        .filter(Sale.paid.is_(True), Comision.id.is_(None))
        .order_by(Sale.id.desc())
        .all()
    )
    return [
        {
            "sale_id": s.id,
            "cliente_nombre": s.customer_name,
            "total": float(s.total_amount),
            "vendedor_id": s.seller_id,
            "vendedor_nombre": s.seller.nombre if s.seller else None,
        }
        for s in ventas
    ]


# ─── Minorista: matriz semanal ──────────────────────────────────────────────

def semana_de(momento_utc: datetime) -> tuple[date, datetime, datetime]:
    """Semana (lunes a domingo, hora Argentina) que contiene `momento_utc`
    (datetime naive en UTC, como los created_at de la DB). Devuelve el lunes
    y los límites [inicio, fin) de la semana, también naive en UTC."""
    local = momento_utc.replace(tzinfo=timezone.utc).astimezone(TZ_AR)
    lunes = local.date() - timedelta(days=local.weekday())
    return (lunes, *_limites_semana(lunes))


def _limites_semana(lunes: date) -> tuple[datetime, datetime]:
    inicio = datetime.combine(lunes, time.min, tzinfo=TZ_AR)
    fin = inicio + timedelta(days=7)
    return (
        inicio.astimezone(timezone.utc).replace(tzinfo=None),
        fin.astimezone(timezone.utc).replace(tzinfo=None),
    )


def tramos_minoristas(db: Session) -> list[tuple[Decimal, Decimal]]:
    """Matriz (monto_desde, porcentaje) ordenada por monto_desde."""
    return [
        (Decimal(str(t.monto_desde)), Decimal(str(t.porcentaje)))
        for t in db.query(ComisionMinoristaTramo).order_by(ComisionMinoristaTramo.monto_desde).all()
    ]


def _tramo_aplica(volumen: Decimal, desde: Decimal) -> bool:
    # Un tramo aplica cuando la venta semanal supera su monto_desde; el que
    # arranca en 0 aplica desde el primer peso.
    return desde <= 0 or volumen > desde


def detalle_tramos(
    volumen: Decimal, tramos: list[tuple[Decimal, Decimal]], escalonada: bool
) -> tuple[Decimal, list[dict]]:
    """Resuelve la matriz para un volumen semanal. Devuelve la tasa
    (fracción, no %) a aplicar sobre la venta no-oferta, y el detalle por
    tramo para mostrar: rango, %, si se alcanzó, si es el actual, y (en
    escalonado) cuánto de la venta cae en ese tramo.

    - Sobre toda la venta: la tasa es el % del tramo más alto alcanzado.
    - Escalonado: cada tramo cobra su % sólo sobre la porción del volumen
      que cae dentro de él; la tasa es el promedio resultante (comisión
      escalonada / volumen), así se puede repartir proporcional entre las
      ventas de la semana."""
    detalle: list[dict] = []
    actual_idx: int | None = None
    comision_escalonada = Decimal("0")
    for i, (desde, porcentaje) in enumerate(tramos):
        hasta = tramos[i + 1][0] if i + 1 < len(tramos) else None
        alcanzado = _tramo_aplica(volumen, desde)
        if alcanzado:
            actual_idx = i
        tope = volumen if hasta is None else min(volumen, hasta)
        monto_en_tramo = max(tope - max(desde, Decimal("0")), Decimal("0"))
        comision_escalonada += monto_en_tramo * porcentaje / 100
        detalle.append({
            "monto_desde": float(desde),
            "monto_hasta": float(hasta) if hasta is not None else None,
            "porcentaje": float(porcentaje),
            "alcanzado": alcanzado,
            "actual": False,
            "monto_en_tramo": float(monto_en_tramo),
        })
    if actual_idx is not None:
        detalle[actual_idx]["actual"] = True

    if escalonada:
        tasa = (comision_escalonada / volumen) if volumen > 0 else (
            tramos[0][1] / 100 if tramos and tramos[0][0] <= 0 else Decimal("0")
        )
    else:
        tasa = tramos[actual_idx][1] / 100 if actual_idx is not None else Decimal("0")
    return tasa, detalle


def _bases_venta(sale: Sale) -> tuple[Decimal, Decimal]:
    """(base total, parte en oferta) de una venta."""
    base = Decimal(str(sale.total_amount or 0))
    oferta = sum(
        (Decimal(str(i.total_price or 0)) for i in sale.items if i.es_oferta),
        Decimal("0"),
    )
    return base, min(oferta, base).quantize(Decimal("0.01"))


def _aplicar_matriz(c: Comision, tasa_normal: Decimal, oferta_porcentaje: Decimal) -> None:
    sale = c.sale
    base = Decimal(str(c.base))
    if sale is not None and (sale.comision_porcentaje_manual is not None or sale.comision_monto_manual is not None):
        c.tasa, c.monto = resolver_tasa_monto(
            base, Decimal("0"), sale.comision_porcentaje_manual, sale.comision_monto_manual
        )
        return
    base_oferta = Decimal(str(c.base_oferta or 0))
    monto = ((base - base_oferta) * tasa_normal + base_oferta * oferta_porcentaje / 100).quantize(Decimal("0.01"))
    c.monto = monto
    c.tasa = (monto / base).quantize(Decimal("0.0001")) if base else Decimal("0")


def _comisiones_minoristas_semana(db: Session, vendedor_id: int, inicio: datetime, fin: datetime) -> list[Comision]:
    return (
        db.query(Comision)
        .filter(
            Comision.vendedor_id == vendedor_id,
            Comision.sale_id.isnot(None),
            Comision.created_at >= inicio,
            Comision.created_at < fin,
        )
        .order_by(Comision.created_at, Comision.id)
        .all()
    )


def recalcular_semana_minorista(db: Session, vendedor_id: int, momento_utc: datetime) -> None:
    """Recalcula las comisiones minoristas pendientes del vendedor en la
    semana que contiene `momento_utc`. Las liquidadas no se tocan, pero su
    base suma igual al volumen de la semana. No hace commit."""
    _, inicio, fin = semana_de(momento_utc)
    comisiones = _comisiones_minoristas_semana(db, vendedor_id, inicio, fin)
    volumen = sum((Decimal(str(c.base)) for c in comisiones), Decimal("0"))

    cfg = db.query(ConfiguracionComercio).first()
    escalonada = bool(cfg.comision_minorista_escalonada) if cfg else False
    oferta_porcentaje = Decimal(str(cfg.comision_minorista_oferta_porcentaje)) if cfg else Decimal("0")
    tasa_normal, _ = detalle_tramos(volumen, tramos_minoristas(db), escalonada)

    for c in comisiones:
        if c.estado == "pendiente":
            _aplicar_matriz(c, tasa_normal, oferta_porcentaje)


def recalcular_semana_actual(db: Session) -> None:
    """Recalcula la semana en curso de todos los vendedores — tras cambiar
    la matriz o los % minoristas en el admin, para que lo que ve cada
    vendedor refleje la configuración nueva. Las semanas cerradas no se
    tocan. No hace commit."""
    ahora = datetime.utcnow()
    _, inicio, fin = semana_de(ahora)
    vendedor_ids = [
        v for (v,) in db.query(Comision.vendedor_id)
        .filter(Comision.sale_id.isnot(None), Comision.created_at >= inicio, Comision.created_at < fin)
        .distinct()
        .all()
    ]
    for vendedor_id in vendedor_ids:
        recalcular_semana_minorista(db, vendedor_id, ahora)


def sincronizar_comision_minorista(db: Session, sale: Sale, fecha: datetime | None = None) -> Comision | None:
    """Crea (o recalcula, si sigue pendiente) la comisión de una venta
    minorista pagada, atribuida directamente a Sale.seller_id, y recalcula
    la semana del vendedor (ver recalcular_semana_minorista). No hace
    commit — se llama desde SalesService dentro de la misma transacción que
    guarda la venta, tanto en la transición no-pagada -> pagada como en
    cualquier guardado posterior de una venta ya pagada (por si cambió el
    total, los items, el vendedor o el override manual). Si la venta no está
    pagada, no hace nada. Una comisión ya liquidada no se recalcula acá.

    `fecha` define la semana de una comisión nueva (default: ahora, o sea
    la semana en que la venta quedó pagada)."""
    if not sale.paid:
        return None

    base, base_oferta = _bases_venta(sale)
    comision = db.query(Comision).filter(Comision.sale_id == sale.id).first()
    vendedor_anterior = None
    if comision is None:
        comision = Comision(
            vendedor_id=sale.seller_id,
            sale_id=sale.id,
            base=base,
            base_oferta=base_oferta,
            tasa=Decimal("0"),
            monto=Decimal("0"),
            estado="pendiente",
            created_at=fecha or datetime.utcnow(),
        )
        db.add(comision)
    elif comision.estado == "pendiente":
        if comision.vendedor_id != sale.seller_id:
            vendedor_anterior = comision.vendedor_id
            comision.vendedor_id = sale.seller_id
        comision.base = base
        comision.base_oferta = base_oferta
    else:
        return comision

    db.flush()
    recalcular_semana_minorista(db, comision.vendedor_id, comision.created_at)
    if vendedor_anterior is not None:
        recalcular_semana_minorista(db, vendedor_anterior, comision.created_at)
    return comision


def resumen_semana_minorista(db: Session, vendedor_id: int, lunes: date) -> dict:
    """Detalle de una semana para el portal del vendedor: volumen (normal y
    oferta), tramos de la matriz con el alcanzado, cuánto falta para el
    siguiente, y la comisión acumulada (provisoria mientras la semana esté
    abierta). La comisión es la suma de lo guardado en cada venta (incluye
    overrides manuales y ediciones del admin); los tramos se muestran con la
    matriz vigente."""
    inicio, fin = _limites_semana(lunes)
    comisiones = _comisiones_minoristas_semana(db, vendedor_id, inicio, fin)
    volumen = sum((Decimal(str(c.base)) for c in comisiones), Decimal("0"))
    volumen_oferta = sum((Decimal(str(c.base_oferta or 0)) for c in comisiones), Decimal("0"))

    cfg = db.query(ConfiguracionComercio).first()
    escalonada = bool(cfg.comision_minorista_escalonada) if cfg else False
    oferta_porcentaje = Decimal(str(cfg.comision_minorista_oferta_porcentaje)) if cfg else Decimal("0")
    tramos = tramos_minoristas(db)
    tasa_normal, detalle = detalle_tramos(volumen, tramos, escalonada)

    siguiente = next((t for t in detalle if not t["alcanzado"]), None)
    return {
        "semana_inicio": lunes.isoformat(),
        "semana_fin": (lunes + timedelta(days=6)).isoformat(),
        "cerrada": datetime.utcnow() >= fin,
        "escalonada": escalonada,
        "volumen": float(volumen),
        "volumen_normal": float(volumen - volumen_oferta),
        "volumen_oferta": float(volumen_oferta),
        "tramos": detalle,
        "porcentaje_normal": float((tasa_normal * 100).quantize(Decimal("0.01"))),
        "porcentaje_oferta": float(oferta_porcentaje),
        "siguiente_tramo": {
            "monto_desde": siguiente["monto_desde"],
            "porcentaje": siguiente["porcentaje"],
            "falta": max(siguiente["monto_desde"] - float(volumen), 0.0),
        } if siguiente else None,
        "comision_total": sum(float(c.monto) for c in comisiones),
        "comision_pendiente": sum(float(c.monto) for c in comisiones if c.estado == "pendiente"),
        "comision_liquidada": sum(float(c.monto) for c in comisiones if c.estado == "liquidada"),
        "ventas": [
            {
                "id": c.id,
                "sale_id": c.sale_id,
                "cliente_nombre": c.sale.customer_name if c.sale else None,
                "fecha": c.created_at.isoformat(),
                "base": float(c.base),
                "base_oferta": float(c.base_oferta or 0),
                "tasa": float(c.tasa),
                "monto": float(c.monto),
                "estado": c.estado,
                "manual": bool(c.sale and (
                    c.sale.comision_porcentaje_manual is not None or c.sale.comision_monto_manual is not None
                )),
            }
            for c in comisiones
        ],
    }


def semanas_minoristas_vendedor(db: Session, vendedor_id: int, limite: int = 8) -> list[dict]:
    """Semana actual (siempre, aunque no tenga ventas) + las últimas
    semanas con comisiones minoristas, de la más nueva a la más vieja."""
    lunes_actual = semana_de(datetime.utcnow())[0]
    fechas = [
        f for (f,) in db.query(Comision.created_at)
        .filter(Comision.vendedor_id == vendedor_id, Comision.sale_id.isnot(None))
        .all()
    ]
    lunes_set = {semana_de(f)[0] for f in fechas} | {lunes_actual}
    lunes_lista = sorted(lunes_set, reverse=True)[:limite]
    return [resumen_semana_minorista(db, vendedor_id, l) for l in lunes_lista]


def generar_comision_minorista(db: Session, sale_id: int) -> dict:
    """Generación manual de la comisión de una venta minorista pagada —
    pensada como backfill para ventas que quedaron pagadas antes de que el
    trigger automático (sincronizar_comision_minorista) existiera. La
    comisión se ubica en la semana de la venta (no en la actual, para no
    inflar el tramo de esta semana con ventas viejas). Idempotente por el
    índice único en sale_id."""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise NotFoundError("Sale", str(sale_id))
    if not sale.paid:
        raise ValidationError("La venta todavía no está pagada.")

    comision = sincronizar_comision_minorista(db, sale, fecha=sale.created_at)
    db.commit()
    db.refresh(comision)
    return comision_dict(comision)


def generar_comisiones_pendientes(db: Session) -> dict:
    """Backfill masivo: genera la comisión de todas las ventas minoristas
    pagadas que todavía no la tienen (ver listar_ventas_minoristas_pendientes_comision),
    en un solo click en vez de una por una. Un commit por venta, para que un
    error puntual no tire abajo el resto del lote."""
    sale_ids = [
        s.id for s in db.query(Sale.id)
        .outerjoin(Comision, Comision.sale_id == Sale.id)
        .filter(Sale.paid.is_(True), Comision.id.is_(None))
        .all()
    ]

    generadas: list[dict] = []
    errores: list[dict] = []
    for sale_id in sale_ids:
        try:
            generadas.append(generar_comision_minorista(db, sale_id))
        except AppException as e:
            db.rollback()
            errores.append({"sale_id": sale_id, "error": e.message})

    return {"generadas": len(generadas), "comisiones": generadas, "errores": errores}


def editar_comision(db: Session, comision_id: int, cambios: dict) -> dict:
    """Edición manual de una comisión pendiente (de cualquier canal). Si se
    manda `tasa` sin `monto`, el monto se recalcula sobre la base guardada;
    si se manda `monto`, ese valor pisa el cálculo (ajuste puntual). Una
    comisión ya liquidada no se edita: primero hay que anular su liquidación."""
    c = db.query(Comision).filter(Comision.id == comision_id).first()
    if not c:
        raise NotFoundError("Comision", str(comision_id))

    if "estado" in cambios:
        raise ValidationError(
            "El estado se maneja desde las liquidaciones semanales: liquidá la semana o anulá la liquidación."
        )
    if c.liquidacion_id is not None:
        raise ValidationError("La comisión ya está liquidada; anulá la liquidación para poder editarla.")

    nueva_tasa = cambios.get("tasa")
    nuevo_monto = cambios.get("monto")
    if nueva_tasa is not None:
        c.tasa = Decimal(str(nueva_tasa))
        if nuevo_monto is None:
            c.monto = (c.base * c.tasa).quantize(Decimal("0.01"))
    if nuevo_monto is not None:
        c.monto = Decimal(str(nuevo_monto))

    db.commit()
    db.refresh(c)
    return comision_dict(c)
