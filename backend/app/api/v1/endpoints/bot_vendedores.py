"""Endpoints para el bot de ventas de vendedores por WhatsApp (orquestado desde n8n).

Convención de `varianteId` (no se crea una entidad "variante" nueva):
- positivo -> product_color_stock.id (producto con color)
- negativo -> -product_deposit_stock.id (producto sin color)

Reutiliza SalesService.create_sale/update_sale para no duplicar la lógica de
descuento de stock (incluye product_deposit_stock, el stock manual por
depósito de productos sin color).
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
from app.models.sale import Sale
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


@router.post("/bot-vendedores/orden", dependencies=[Depends(verify_bot_key)])
async def crear_orden(body: dict, db: Session = Depends(get_db)):
    celular = body.get("celular") or ""
    variante_id = int(body["varianteId"])
    cantidad = int(body["cantidad"])
    entregado = bool(body.get("entregado", False))

    vendedor = _resolve_vendedor(db, celular)
    if not vendedor:
        return {"vendedor": None}

    deposito = _vendedor_deposito(db, vendedor)
    if not deposito:
        return JSONResponse(status_code=409, content={"error": "stock_insuficiente", "disponible": 0})

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

    if not row:
        return JSONResponse(status_code=409, content={"error": "stock_insuficiente", "disponible": 0})
    if int(row.quantity) < cantidad:
        return JSONResponse(status_code=409, content={"error": "stock_insuficiente", "disponible": int(row.quantity)})

    product = db.query(Product).filter(Product.id == row.product_id).first()
    unit_price = product.final_price if product else None
    if not unit_price or unit_price <= 0:
        return JSONResponse(status_code=400, content={"error": "producto_sin_precio"})

    color = row.color if es_color else None
    data = SaleCreate(
        notes="Venta por WhatsApp (bot vendedores)",
        seller_id=vendedor.id,
        delivered=entregado,
        paid=False,
        items=[SaleItemCreate(
            product_id=product.id,
            color=color,
            quantity=cantidad,
            unit_price=unit_price,
            delivered=entregado,
            paid=False,
        )],
    )
    sale = SalesService(db).create_sale(data)
    sale.origen = "vendedor"
    db.commit()
    db.refresh(sale)
    db.refresh(row)
    label = _color_label(db, product.id, color)

    return {
        "ordenId": sale.id,
        "estado": "Entregado" if sale.delivered else "Pendiente",
        "nombre": product.display_name_bot(label),
        "cantidad": cantidad,
        "disponibleRestante": int(row.quantity),
    }


@router.get("/bot-vendedores/pendientes", dependencies=[Depends(verify_bot_key)])
async def get_pendientes(celular: str = Query(...), db: Session = Depends(get_db)):
    vendedor = _resolve_vendedor(db, celular)
    if not vendedor:
        return {"vendedor": None}

    sales = (
        db.query(Sale)
        .options(selectinload(Sale.items))
        .filter(Sale.seller_id == vendedor.id, Sale.origen == "vendedor", Sale.delivered.is_(False))
        .order_by(Sale.created_at.asc())
        .all()
    )

    ordenes = []
    for sale in sales:
        nombres = []
        cantidad_total = 0
        for item in sale.items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            label = _color_label(db, item.product_id, item.color) if item.product_id else None
            nombres.append(product.display_name_bot(label) if product else (item.manual_product_name or "Producto"))
            cantidad_total += int(item.quantity)
        ordenes.append({
            "ordenId": sale.id,
            "nombre": " + ".join(nombres),
            "cantidad": cantidad_total,
            "creada": sale.created_at.isoformat() if sale.created_at else None,
        })

    return {"vendedor": _vendedor_dict(vendedor), "ordenes": ordenes}


@router.post("/bot-vendedores/entregar", dependencies=[Depends(verify_bot_key)])
async def entregar_orden(body: dict, db: Session = Depends(get_db)):
    celular = body.get("celular") or ""
    orden_id = int(body["ordenId"])

    vendedor = _resolve_vendedor(db, celular)
    if not vendedor:
        return {"vendedor": None}

    sale = db.query(Sale).filter(Sale.id == orden_id).first()
    if not sale or sale.seller_id != vendedor.id or sale.delivered:
        return JSONResponse(status_code=409, content={"error": "orden_invalida"})

    SalesService(db).update_sale(sale.id, delivered=True, paid=None)
    db.refresh(sale)

    return {"ordenId": sale.id, "estado": "Entregado"}
