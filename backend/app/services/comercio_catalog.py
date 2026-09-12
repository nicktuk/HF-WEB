"""Lógica compartida del catálogo comercios: selección de productos, costo y precio.

Usado tanto por el catálogo público (sin precios, para previsualizar sin login)
como por el catálogo protegido (con precios, requiere sesión) — ambos deben
mostrar exactamente el mismo conjunto de productos.
"""
import math
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.comercio import ConfiguracionComercio, DescuentoTramoComercio
from app.models.product import Product
from app.models.stock import StockPurchase


def get_config(db: Session) -> ConfiguracionComercio:
    cfg = db.query(ConfiguracionComercio).first()
    if not cfg:
        cfg = ConfiguracionComercio(descuento_porcentaje=25, redondeo=100, monto_minimo_pedido=0)
    return cfg


def get_tramos_descuento(db: Session) -> list[dict]:
    """Matriz cantidad/descuento ordenada ascendente por cantidad_minima."""
    tramos = db.query(DescuentoTramoComercio).order_by(DescuentoTramoComercio.cantidad_minima).all()
    return [
        {"cantidad_minima": t.cantidad_minima, "descuento_porcentaje": float(t.descuento_porcentaje)}
        for t in tramos
    ]


def descuento_para_cantidad(tramos: list[dict], cantidad: int) -> float:
    """Descuento % aplicable a `cantidad` unidades según la matriz de tramos.

    Usa el tramo de mayor cantidad_minima que la cantidad alcance. Si no
    alcanza ni el tramo más bajo, no hay descuento (precio minorista completo).
    """
    aplicable = 0.0
    for t in tramos:
        if t["cantidad_minima"] <= cantidad:
            aplicable = t["descuento_porcentaje"]
        else:
            break
    return aplicable


def ultimo_precio_compra(db: Session, product_id: int) -> Optional[Decimal]:
    result = db.query(StockPurchase.unit_price).filter(
        StockPurchase.product_id == product_id
    ).order_by(StockPurchase.purchase_date.desc()).first()
    return Decimal(str(result[0])) if result else None


def stock_total(db: Session, product_id: int) -> int:
    result = db.query(
        func.coalesce(func.sum(StockPurchase.quantity - StockPurchase.out_quantity), 0)
    ).filter(StockPurchase.product_id == product_id).scalar()
    return int(result or 0)


def precio_comercio(
    costo: Optional[Decimal],
    override: Optional[Decimal],
    cfg: ConfiguracionComercio,
    precio_venta: Optional[int] = None,
    cantidad: int = 1,
    tramos: Optional[list[dict]] = None,
) -> Decimal:
    """Precio unitario real para `cantidad` unidades pedidas.

    En modo 'descuento': parte del precio minorista (precio_venta) y descuenta
    el % que corresponda a `cantidad` según la matriz de tramos.
    En modo 'markup' (default): igual que siempre, sobre el costo de compra.
    """
    if override is not None:
        return override
    if cfg.modo_precio == 'descuento' and precio_venta is not None:
        descuento = descuento_para_cantidad(tramos or [], cantidad)
        precio = float(precio_venta) * (1 - descuento / 100)
    elif cfg.tipo_markup == 'variable' and precio_venta is not None:
        precio = (float(costo) + float(precio_venta)) / 2
    else:
        precio = float(costo) * (1 + float(cfg.descuento_porcentaje) / 100)
    if cfg.redondeo > 0:
        precio = math.ceil(precio / cfg.redondeo) * cfg.redondeo
    return Decimal(str(int(precio)))


def precio_referencia(
    costo: Optional[Decimal],
    override: Optional[Decimal],
    cfg: ConfiguracionComercio,
    precio_venta: Optional[int] = None,
) -> Decimal:
    """Precio a mostrar en listado/ficha antes de elegir cantidad.

    En modo 'descuento' es el precio minorista sin descontar (el descuento
    real depende de la cantidad y se muestra aparte, en la matriz de tramos).
    En modo 'markup' es el mismo cálculo de siempre, sin cantidad.
    """
    if override is not None:
        return override
    if cfg.modo_precio == 'descuento':
        return Decimal(str(int(precio_venta))) if precio_venta is not None else Decimal('0')
    return precio_comercio(costo, None, cfg, precio_venta)


def productos_visibles(db: Session, cfg: ConfiguracionComercio) -> list[tuple[Product, Decimal, int]]:
    """Productos visibles en el canal comercios, con costo y stock ya resueltos.

    Devuelve tuplas (producto, costo, stock) aplicando las mismas reglas de
    selección tanto en modo normal (es_mayorista) como en 'mostrar_todos_con_stock'.
    """
    if cfg.mostrar_todos_con_stock:
        products = (
            db.query(Product)
            .filter(Product.enabled == True)
            .order_by(Product.display_order, Product.id)
            .all()
        )
    else:
        products = (
            db.query(Product)
            .filter(Product.enabled == True, Product.es_mayorista == True)
            .order_by(Product.display_order, Product.id)
            .all()
        )

    visibles: list[tuple[Product, Decimal, int]] = []
    for p in products:
        if cfg.modo_precio == 'descuento':
            # En modo descuento el precio parte del precio minorista, no del
            # costo de compra — la visibilidad depende de que haya precio de venta.
            if p.final_price is None:
                continue
            stock = stock_total(db, p.id)
            if stock == 0 and not p.is_on_demand:
                continue
            costo = ultimo_precio_compra(db, p.id)  # informativo, puede ser None
            visibles.append((p, costo, stock))
            continue

        costo = ultimo_precio_compra(db, p.id)

        if cfg.mostrar_todos_con_stock:
            if costo is None:
                continue
            stock = stock_total(db, p.id)
            if stock == 0:
                continue
            precio_venta = p.final_price
            if precio_venta is None:
                continue
            markup = (float(precio_venta) - float(costo)) / float(precio_venta) * 100
            if markup <= 50:
                continue
        else:
            if costo is None:
                costo = p.original_price
            if costo is None:
                continue
            stock = stock_total(db, p.id)
            if stock == 0 and not p.is_on_demand:
                continue

        visibles.append((p, costo, stock))

    return visibles


def producto_visible(db: Session, cfg: ConfiguracionComercio, product_id: int) -> Optional[tuple[Product, Decimal, int]]:
    """Devuelve (producto, costo, stock) si el producto es visible en el canal comercios, o None.

    Reutiliza productos_visibles para no duplicar las reglas de selección — la
    ficha de producto debe mostrar exactamente los mismos productos que el listado.
    """
    for p, costo, stock in productos_visibles(db, cfg):
        if p.id == product_id:
            return p, costo, stock
    return None
