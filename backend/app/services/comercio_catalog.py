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

from app.models.comercio import ConfiguracionComercio
from app.models.product import Product
from app.models.stock import StockPurchase


def get_config(db: Session) -> ConfiguracionComercio:
    cfg = db.query(ConfiguracionComercio).first()
    if not cfg:
        cfg = ConfiguracionComercio(descuento_porcentaje=25, redondeo=100, monto_minimo_pedido=0)
    return cfg


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
    costo: Decimal,
    override: Optional[Decimal],
    cfg: ConfiguracionComercio,
    precio_venta: Optional[int] = None,
) -> Decimal:
    if override is not None:
        return override
    if cfg.tipo_markup == 'variable' and precio_venta is not None:
        precio = (float(costo) + float(precio_venta)) / 2
    else:
        precio = float(costo) * (1 + float(cfg.descuento_porcentaje) / 100)
    if cfg.redondeo > 0:
        precio = math.ceil(precio / cfg.redondeo) * cfg.redondeo
    return Decimal(str(int(precio)))


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
