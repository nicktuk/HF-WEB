"""Lógica compartida del catálogo comercios: selección de productos y precio.

Usado tanto por el catálogo público (sin precios, para previsualizar sin login)
como por el catálogo protegido (con precios, requiere sesión) — ambos deben
mostrar exactamente el mismo conjunto de productos.

El precio del canal comercios es propio de cada producto (precio_mayorista),
no se calcula a partir del precio minorista ni del costo; la matriz de
descuento por cantidad se aplica sobre ese precio.

La configuración específica del canal comercios (es_mayorista, precio
mayorista, unidades por bulto, cantidad mínima, descripción, fotos propias) vive
en ProductComercioConfig/ProductComercioImage — separada de Product a
propósito, para no seguir mezclando campos del minorista y el mayorista.
"""
import math
from decimal import Decimal
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.comercio import ConfiguracionComercio, DescuentoTramoComercio
from app.models.product import Product
from app.models.product_comercio import ProductComercioConfig
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
    alcanza ni el tramo más bajo, no hay descuento (precio mayorista completo).
    """
    aplicable = 0.0
    for t in tramos:
        if t["cantidad_minima"] <= cantidad:
            aplicable = t["descuento_porcentaje"]
        else:
            break
    return aplicable


def stock_total(db: Session, product_id: int) -> int:
    result = db.query(
        func.coalesce(func.sum(StockPurchase.quantity - StockPurchase.out_quantity), 0)
    ).filter(StockPurchase.product_id == product_id).scalar()
    return int(result or 0)


def get_comercio_config(db: Session, product_id: int) -> Optional[ProductComercioConfig]:
    return db.query(ProductComercioConfig).filter(ProductComercioConfig.product_id == product_id).first()


def precio_comercio(
    precio_mayorista: Decimal,
    cfg: ConfiguracionComercio,
    cantidad: int = 1,
    tramos: Optional[list[dict]] = None,
) -> Decimal:
    """Precio unitario real para `cantidad` unidades pedidas.

    Parte del precio mayorista propio del producto y descuenta el % que
    corresponda a `cantidad` según la matriz de tramos. No depende del
    precio minorista ni del costo de compra.
    """
    descuento = descuento_para_cantidad(tramos or [], cantidad)
    precio = float(precio_mayorista) * (1 - descuento / 100)
    if cfg.redondeo > 0:
        precio = math.ceil(precio / cfg.redondeo) * cfg.redondeo
    return Decimal(str(int(precio)))


def productos_visibles(
    db: Session, cfg: ConfiguracionComercio
) -> list[tuple[Product, Decimal, int, ProductComercioConfig]]:
    """Productos visibles en el canal comercios, con precio mayorista, stock
    y su config de comercio ya resueltos.

    Visibles: habilitados, marcados como mayoristas, con precio mayorista
    cargado y con stock (o a pedido). Devuelve tuplas
    (producto, precio_mayorista, stock, config).
    """
    rows = (
        db.query(Product, ProductComercioConfig)
        .join(ProductComercioConfig, ProductComercioConfig.product_id == Product.id)
        .filter(
            Product.enabled == True,
            ProductComercioConfig.es_mayorista == True,
            ProductComercioConfig.precio_mayorista.isnot(None),
        )
        .order_by(Product.display_order, Product.id)
        .all()
    )

    visibles: list[tuple[Product, Decimal, int, ProductComercioConfig]] = []
    for p, config in rows:
        stock = stock_total(db, p.id)
        if stock == 0 and not p.is_on_demand:
            continue
        visibles.append((p, Decimal(config.precio_mayorista), stock, config))

    return visibles


def producto_visible(
    db: Session, cfg: ConfiguracionComercio, product_id: int
) -> Optional[tuple[Product, Decimal, int, ProductComercioConfig]]:
    """Devuelve (producto, precio_mayorista, stock, config) si el producto es
    visible en el canal comercios, o None.

    Reutiliza productos_visibles para no duplicar las reglas de selección — la
    ficha de producto debe mostrar exactamente los mismos productos que el listado.
    """
    for p, precio_mayorista, stock, config in productos_visibles(db, cfg):
        if p.id == product_id:
            return p, precio_mayorista, stock, config
    return None
