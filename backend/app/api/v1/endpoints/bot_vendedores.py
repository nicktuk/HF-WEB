"""Endpoints para el bot de ventas de vendedores por WhatsApp (orquestado desde n8n).

Convención de `varianteId` (no se crea una entidad "variante" nueva):
- positivo -> product_color_stock.id (producto con color)
- negativo -> -product_deposit_stock.id (producto sin color)

Reutiliza SalesService.create_sale y SalesService._apply_item_states (mismo método
interno que usan create_sale/update_sale) para no duplicar la lógica de descuento
de stock (incluye product_deposit_stock, el stock manual por depósito de productos
sin color) ni la de entrega parcial por línea.
"""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.core.security import verify_bot_key
from app.core.phone import normalizar_celular
from app.models.catalog_seller import CatalogSeller
from app.models.stock import Deposit
from app.models.product import Product, ProductColorStock, ProductDepositStock, ProductImage
from app.models.sale import Sale, SaleItem
from app.services.sales import SalesService
from app.schemas.sales import SaleCreate, SaleItemCreate

router = APIRouter()


def _resolve_vendedor(db: Session, celular: str) -> Optional[CatalogSeller]:
    celular_normalizado = normalizar_celular(celular)
    return (
        db.query(CatalogSeller)
        .filter(
            CatalogSeller.celular_normalizado == celular_normalizado,
            CatalogSeller.bot_habilitado.is_(True),
            CatalogSeller.activo.is_(True),
        )
        .first()
    )


def _vendedor_deposito(db: Session, vendedor: CatalogSeller) -> Optional[Deposit]:
    return (
        db.query(Deposit)
        .filter(Deposit.seller_id == vendedor.id, Deposit.is_active.is_(True))
        .first()
    )


def _vendedor_dict(v: CatalogSeller) -> dict:
    return {"id": v.id, "nombre": v.nombre}


def _color_label(db: Session, product_id: int, color: Optional[str]) -> Optional[str]:
    if not color:
        return None
    img = (
        db.query(ProductImage.alt_text)
        .filter(ProductImage.product_id == product_id, ProductImage.color == color)
        .first()
    )
    return img.alt_text if img and img.alt_text else None


@router.get("/bot-vendedores/stock", dependencies=[Depends(verify_bot_key)])
async def get_stock(celular: str = Query(...), db: Session = Depends(get_db)):
    vendedor = _resolve_vendedor(db, celular)
    if not vendedor:
        return {"vendedor": None}

    deposito = _vendedor_deposito(db, vendedor)
    if not deposito:
        return {"vendedor": _vendedor_dict(vendedor), "items": []}

    items = []

    color_rows = (
        db.query(ProductColorStock)
        .options(selectinload(ProductColorStock.product))
        .filter(ProductColorStock.deposit_id == deposito.id, ProductColorStock.quantity > 0)
        .all()
    )
    for row in color_rows:
        label = _color_label(db, row.product_id, row.color)
        items.append({
            "varianteId": row.id,
            "nombre": row.product.display_name_bot(label),
            "disponible": int(row.quantity),
        })

    productos_con_color = db.query(ProductColorStock.product_id).distinct().subquery()
    deposit_rows = (
        db.query(ProductDepositStock)
        .options(selectinload(ProductDepositStock.product))
        .filter(
            ProductDepositStock.deposit_id == deposito.id,
            ProductDepositStock.quantity > 0,
            ProductDepositStock.product_id.notin_(productos_con_color),
        )
        .all()
    )
    for row in deposit_rows:
        items.append({
            "varianteId": -row.id,
            "nombre": row.product.display_name_bot(),
            "disponible": int(row.quantity),
        })

    items.sort(key=lambda i: i["nombre"])
    return {"vendedor": _vendedor_dict(vendedor), "items": items}


def _estado_venta(sale: Sale) -> str:
    """Misma regla que usa el admin (ventas/page.tsx) para derivar entregado/parcial/pendiente
    a partir de total_amount vs delivered_amount, ya calculados por SalesService._sync_sale_state."""
    total = float(sale.total_amount or 0)
    delivered_amount = float(sale.delivered_amount or 0)
    eps = 0.01
    if total <= 0 or delivered_amount <= eps:
        return "Pendiente"
    if delivered_amount >= total - eps:
        return "Entregado"
    return "Entregado parcial"


def _resolve_stock_row(db: Session, deposito: Deposit, variante_id: int):
    es_color = variante_id > 0
    if es_color:
        row = (
            db.query(ProductColorStock)
            .filter(ProductColorStock.id == variante_id, ProductColorStock.deposit_id == deposito.id)
            .first()
        )
    else:
        row = (
            db.query(ProductDepositStock)
            .filter(ProductDepositStock.id == -variante_id, ProductDepositStock.deposit_id == deposito.id)
            .first()
        )
    return row, es_color


@router.post("/bot-vendedores/orden", dependencies=[Depends(verify_bot_key)])
async def crear_orden(body: dict, db: Session = Depends(get_db)):
    celular = body.get("celular") or ""
    items_raw = body.get("items")
    if not items_raw:
        items_raw = [{
            "varianteId": body["varianteId"],
            "cantidad": body["cantidad"],
            "entregado": body.get("entregado", False),
        }]

    vendedor = _resolve_vendedor(db, celular)
    if not vendedor:
        return {"vendedor": None}

    deposito = _vendedor_deposito(db, vendedor)
    if not deposito:
        return JSONResponse(status_code=409, content={"error": "stock_insuficiente", "varianteId": None, "disponible": 0, "nombre": None})

    # Merge por varianteId (suma cantidades de líneas repetidas).
    merged: dict[int, dict] = {}
    order: list[int] = []
    for raw in items_raw:
        variante_id = int(raw["varianteId"])
        cantidad = int(raw["cantidad"])
        entregado = bool(raw.get("entregado", False))
        if variante_id not in merged:
            merged[variante_id] = {"cantidad": 0, "entregado": entregado}
            order.append(variante_id)
        merged[variante_id]["cantidad"] += cantidad

    # Validar disponible de TODOS los ítems antes de crear nada.
    resolved: dict[int, dict] = {}
    for variante_id in order:
        cantidad = merged[variante_id]["cantidad"]
        row, es_color = _resolve_stock_row(db, deposito, variante_id)
        if not row:
            return JSONResponse(status_code=409, content={
                "error": "stock_insuficiente", "varianteId": variante_id, "disponible": 0, "nombre": None,
            })
        if int(row.quantity) < cantidad:
            product = db.query(Product).filter(Product.id == row.product_id).first()
            label = _color_label(db, row.product_id, row.color if es_color else None)
            return JSONResponse(status_code=409, content={
                "error": "stock_insuficiente",
                "varianteId": variante_id,
                "disponible": int(row.quantity),
                "nombre": product.display_name_bot(label) if product else None,
            })

        product = db.query(Product).filter(Product.id == row.product_id).first()
        unit_price = product.final_price if product else None
        if not unit_price or unit_price <= 0:
            return JSONResponse(status_code=400, content={"error": "producto_sin_precio", "varianteId": variante_id})

        resolved[variante_id] = {
            "row": row,
            "product": product,
            "color": row.color if es_color else None,
            "unit_price": unit_price,
        }

    sale_items = [
        SaleItemCreate(
            product_id=resolved[variante_id]["product"].id,
            color=resolved[variante_id]["color"],
            quantity=merged[variante_id]["cantidad"],
            unit_price=resolved[variante_id]["unit_price"],
            delivered=merged[variante_id]["entregado"],
            paid=False,
        )
        for variante_id in order
    ]

    data = SaleCreate(
        notes="Venta por WhatsApp (bot vendedores)",
        seller_id=vendedor.id,
        delivered=False,
        paid=False,
        items=sale_items,
    )
    sale = SalesService(db).create_sale(data)
    sale.origen = "vendedor"
    db.commit()
    db.refresh(sale)

    items_by_key = {(it.product_id, it.color or None): it for it in sale.items}
    response_items = []
    for variante_id in order:
        info = resolved[variante_id]
        row = info["row"]
        db.refresh(row)
        sale_item = items_by_key.get((info["product"].id, info["color"]))
        label = _color_label(db, info["product"].id, info["color"])
        response_items.append({
            "varianteId": variante_id,
            "nombre": info["product"].display_name_bot(label),
            "cantidad": merged[variante_id]["cantidad"],
            "entregado": bool(sale_item.delivered) if sale_item else merged[variante_id]["entregado"],
            "disponibleRestante": int(row.quantity),
        })

    return {
        "ordenId": sale.id,
        "estado": _estado_venta(sale),
        "items": response_items,
    }


@router.get("/bot-vendedores/pendientes", dependencies=[Depends(verify_bot_key)])
async def get_pendientes(celular: str = Query(...), db: Session = Depends(get_db)):
    vendedor = _resolve_vendedor(db, celular)
    if not vendedor:
        return {"vendedor": None}

    rows = (
        db.query(SaleItem)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .options(selectinload(SaleItem.sale))
        .filter(
            Sale.seller_id == vendedor.id,
            Sale.origen == "vendedor",
            SaleItem.delivered_quantity < SaleItem.quantity,
        )
        .order_by(Sale.created_at.asc(), SaleItem.id.asc())
        .all()
    )

    lineas = []
    for item in rows:
        sale = item.sale
        product = db.query(Product).filter(Product.id == item.product_id).first() if item.product_id else None
        label = _color_label(db, item.product_id, item.color) if item.product_id else None
        nombre = product.display_name_bot(label) if product else (item.manual_product_name or "Producto")
        lineas.append({
            "lineaId": item.id,
            "ordenId": sale.id,
            "nombre": nombre,
            "cantidad": int(item.quantity - item.delivered_quantity),
            "cliente": sale.customer_name,
            "creada": sale.created_at.isoformat() if sale.created_at else None,
        })

    return {"vendedor": _vendedor_dict(vendedor), "lineas": lineas}


@router.post("/bot-vendedores/entregar", dependencies=[Depends(verify_bot_key)])
async def entregar_orden(body: dict, db: Session = Depends(get_db)):
    celular = body.get("celular") or ""
    linea_id = int(body["lineaId"])

    vendedor = _resolve_vendedor(db, celular)
    if not vendedor:
        return {"vendedor": None}

    item = db.query(SaleItem).filter(SaleItem.id == linea_id).first()
    sale = db.query(Sale).filter(Sale.id == item.sale_id).first() if item else None
    if not item or not sale or sale.seller_id != vendedor.id or sale.origen != "vendedor":
        return JSONResponse(status_code=409, content={"error": "linea_invalida"})
    if int(item.delivered_quantity or 0) >= int(item.quantity or 0):
        return JSONResponse(status_code=409, content={"error": "linea_invalida"})

    item_ref = (
        f"product:{item.product_id}:{(item.color or '').lower()}"
        if item.product_id is not None
        else f"manual:{(item.manual_product_name or '').strip().lower()}"
    )
    SalesService(db)._apply_item_states(sale, {item_ref: True}, None)
    db.commit()
    db.refresh(sale)

    return {"lineaId": item.id, "ordenId": sale.id, "estado": _estado_venta(sale)}
