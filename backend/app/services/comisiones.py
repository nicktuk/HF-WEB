"""Gestión de comisiones de vendedor, cruzando ambos canales (mayorista vía
pedido_id, minorista vía sale_id — ver Comision en models/comercio.py).

El cálculo automático corre en dos puntos: comercio_pedidos.sincronizar_comision_pedido
(se dispara al pagar un pedido mayorista, y al editar su override manual) y
sincronizar_comision_minorista de acá (se dispara cada vez que se guarda una
venta minorista pagada, desde SalesService). Ambos resuelven tasa/monto con
resolver_tasa_monto: si la venta/pedido tiene un override manual cargado
(comision_porcentaje_manual o comision_monto_manual), ese gana sobre la tasa
configurada en el admin (ConfiguracionComercio); si no, se usa la tasa
configurada. Mientras la comisión siga "pendiente" se recalcula en cada
guardado (por si cambió el total o el override); una vez "liquidada" queda
fija y sólo se toca a mano vía editar_comision/PATCH /admin/comisiones/{id}.
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.comercio import Comision, ConfiguracionComercio
from app.models.catalog_seller import CatalogSeller
from app.models.sale import Sale

ESTADOS_COMISION = {"pendiente", "liquidada"}


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


def _comision_dict(c: Comision) -> dict:
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
        "tasa": float(c.tasa),
        "monto": float(c.monto),
        "estado": c.estado,
    }


def listar_comisiones(
    db: Session,
    vendedor_id: int | None = None,
    estado: str | None = None,
    canal: str | None = None,
) -> list[dict]:
    q = db.query(Comision)
    if vendedor_id is not None:
        q = q.filter(Comision.vendedor_id == vendedor_id)
    if estado is not None:
        q = q.filter(Comision.estado == estado)
    if canal == "mayorista":
        q = q.filter(Comision.pedido_id.isnot(None))
    elif canal == "minorista":
        q = q.filter(Comision.sale_id.isnot(None))
    comisiones = q.order_by(Comision.id.desc()).all()
    return [_comision_dict(c) for c in comisiones]


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


def sincronizar_comision_minorista(db: Session, sale: Sale) -> Comision | None:
    """Crea (o recalcula, si sigue pendiente) la comisión de una venta
    minorista pagada, atribuida directamente a Sale.seller_id. No hace
    commit — se llama desde SalesService dentro de la misma transacción que
    guarda la venta, tanto en la transición no-pagada -> pagada como en
    cualquier guardado posterior de una venta ya pagada (por si cambió el
    total o el override manual). Si la venta no está pagada, no hace nada.
    Una comisión ya liquidada no se recalcula acá."""
    if not sale.paid:
        return None

    cfg = db.query(ConfiguracionComercio).first()
    porcentaje_default = cfg.comision_minorista_porcentaje if cfg else Decimal("0")
    base = Decimal(str(sale.total_amount))
    tasa, monto = resolver_tasa_monto(
        base, porcentaje_default, sale.comision_porcentaje_manual, sale.comision_monto_manual
    )

    comision = db.query(Comision).filter(Comision.sale_id == sale.id).first()
    if comision is None:
        comision = Comision(
            vendedor_id=sale.seller_id,
            sale_id=sale.id,
            base=base,
            tasa=tasa,
            monto=monto,
            estado="pendiente",
        )
        db.add(comision)
    elif comision.estado == "pendiente":
        comision.base = base
        comision.tasa = tasa
        comision.monto = monto
    return comision


def generar_comision_minorista(db: Session, sale_id: int) -> dict:
    """Generación manual de la comisión de una venta minorista pagada —
    pensada como backfill para ventas que quedaron pagadas antes de que el
    trigger automático (sincronizar_comision_minorista) existiera. Idempotente
    por el índice único en sale_id."""
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise NotFoundError("Sale", str(sale_id))
    if not sale.paid:
        raise ValidationError("La venta todavía no está pagada.")

    comision = sincronizar_comision_minorista(db, sale)
    db.commit()
    db.refresh(comision)
    return _comision_dict(comision)


def editar_comision(db: Session, comision_id: int, cambios: dict) -> dict:
    """Edición manual de una comisión ya creada (de cualquier canal). Si se
    manda `tasa` sin `monto`, el monto se recalcula sobre la base guardada;
    si se manda `monto`, ese valor pisa el cálculo (ajuste puntual)."""
    c = db.query(Comision).filter(Comision.id == comision_id).first()
    if not c:
        raise NotFoundError("Comision", str(comision_id))

    if "estado" in cambios:
        estado = cambios["estado"]
        if estado not in ESTADOS_COMISION:
            raise ValidationError(f"estado debe ser uno de: {', '.join(sorted(ESTADOS_COMISION))}")
        c.estado = estado

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
    return _comision_dict(c)
