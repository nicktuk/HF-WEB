"""Gestión admin de comisiones de vendedor, cruzando ambos canales
(mayorista vía pedido_id, minorista vía sale_id — ver Comision en
models/comercio.py). El cálculo automático de la comisión mayorista vive en
comercio_pedidos._calcular_comision (se dispara al pagar un pedido); acá
vive lo que es explícitamente admin-driven: generar la comisión minorista
(no hay un trigger automático wireado en el flujo de ventas todavía) y
editar cualquier comisión ya creada, de cualquier canal, caso por caso.
"""
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.exceptions import NotFoundError, ValidationError
from app.models.comercio import Comision, ConfiguracionComercio
from app.models.catalog_seller import CatalogSeller
from app.models.sale import Sale

ESTADOS_COMISION = {"pendiente", "liquidada"}


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
    """Ventas minoristas pagadas que todavía no tienen una comisión generada
    — para que el admin decida caso por caso. Cualquier vendedor de
    catalog_sellers es atribuible (sea o no también mayorista): seller_id
    en Sale ya identifica directamente a la fila de vendedor."""
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


def generar_comision_minorista(db: Session, sale_id: int) -> dict:
    """Genera (o devuelve, si ya existe) la comisión de una venta minorista
    pagada, atribuida directamente a Sale.seller_id (misma tabla que
    vendedores). Idempotente por el índice único en sale_id."""
    existente = db.query(Comision).filter(Comision.sale_id == sale_id).first()
    if existente:
        return _comision_dict(existente)

    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise NotFoundError("Sale", str(sale_id))
    if not sale.paid:
        raise ValidationError("La venta todavía no está pagada.")

    cfg = db.query(ConfiguracionComercio).first()
    porcentaje = cfg.comision_minorista_porcentaje if cfg else Decimal("0")
    tasa = Decimal(str(porcentaje)) / 100

    base = Decimal(str(sale.total_amount))
    monto = (base * tasa).quantize(Decimal("0.01"))

    comision = Comision(
        vendedor_id=sale.seller_id,
        sale_id=sale.id,
        base=base,
        tasa=tasa,
        monto=monto,
        estado="pendiente",
    )
    db.add(comision)
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
