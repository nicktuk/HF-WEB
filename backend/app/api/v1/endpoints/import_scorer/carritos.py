"""CRUD de carritos + items + cotización + knapsack + lista caza."""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.core.security import verify_admin
from app.models.import_scorer.carrito import ImportCarrito, ImportCarritoItem
from app.models.import_scorer.producto import ImportProducto
from app.models.import_scorer.retailer import ImportRetailer
from app.models.import_scorer.config import ImportConfig
from app.schemas.import_scorer.carritos import (
    ImportCarritoCreate,
    ImportCarritoUpdate,
    ImportCarritoResponse,
    ImportCarritoItemCreate,
    ImportCarritoItemUpdate,
    ImportCarritoItemResponse,
)
from app.services.import_scorer.calculations import (
    calcular_resumen_carrito,
    calcular_alertas_carrito,
)

router = APIRouter()

ESTADOS_VALIDOS = ["borrador", "cotizado", "comprado", "en_transito", "recibido", "cancelado"]
TRANSICIONES = {
    "borrador": ["cotizado", "cancelado"],
    "cotizado": ["comprado", "borrador", "cancelado"],
    "comprado": ["en_transito", "cancelado"],
    "en_transito": ["recibido"],
    "recibido": [],
    "cancelado": ["borrador"],
}


def _enrich_item(item: ImportCarritoItem, db: Session) -> ImportCarritoItemResponse:
    producto = db.query(ImportProducto).filter(ImportProducto.id == item.producto_id).first()
    retailer = db.query(ImportRetailer).filter(ImportRetailer.id == item.retailer_id).first() if item.retailer_id else None
    resp = ImportCarritoItemResponse.model_validate(item)
    resp.producto_nombre = producto.nombre if producto else None
    resp.producto_imagen_url = producto.imagen_url if producto else None
    resp.retailer_nombre = retailer.nombre if retailer else None
    return resp


def _build_carrito_response(carrito: ImportCarrito, db: Session) -> ImportCarritoResponse:
    config = db.query(ImportConfig).first()
    costo_flete = config.costo_flete_usd_por_kg if config else 50.0
    sales_tax = config.sales_tax_fl if config else 0.07

    items_resp = [_enrich_item(i, db) for i in carrito.items]

    resumen = None
    alertas = []
    if items_resp and carrito.cotizacion_mep_snapshot:
        items_data = [
            {
                "precio_usd_locked": i.precio_usd_locked,
                "peso_kg_locked": i.peso_kg_locked,
                "cantidad": i.cantidad,
                "cobra_tax_fl": True,
                "en_clearance": i.en_clearance_at_add,
                "nombre": i.producto_nombre,
                "producto_id": i.producto_id,
            }
            for i in items_resp
        ]
        resumen = calcular_resumen_carrito(
            items_data,
            carrito.cotizacion_mep_snapshot,
            costo_flete,
            sales_tax,
        )
        alertas = calcular_alertas_carrito(resumen, items_data)

    resp = ImportCarritoResponse.model_validate(carrito)
    resp.items = items_resp
    resp.total_items = len(items_resp)
    resp.resumen = resumen
    resp.alertas = alertas
    return resp


# ── CRUD carritos ──────────────────────────────────────────────────────────────

@router.get("", response_model=List[ImportCarritoResponse])
def list_carritos(
    estado: Optional[str] = None,
    es_plantilla: Optional[bool] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    q = db.query(ImportCarrito)
    if estado:
        q = q.filter(ImportCarrito.estado == estado)
    if es_plantilla is not None:
        q = q.filter(ImportCarrito.es_plantilla == es_plantilla)
    carritos = q.order_by(ImportCarrito.updated_at.desc()).all()
    return [_build_carrito_response(c, db) for c in carritos]


@router.post("", response_model=ImportCarritoResponse, status_code=201)
def create_carrito(
    data: ImportCarritoCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    carrito = ImportCarrito(**data.model_dump())
    db.add(carrito)
    db.commit()
    db.refresh(carrito)
    return _build_carrito_response(carrito, db)


@router.get("/{carrito_id}", response_model=ImportCarritoResponse)
def get_carrito(
    carrito_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    c = db.query(ImportCarrito).filter(ImportCarrito.id == carrito_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Carrito no encontrado")
    return _build_carrito_response(c, db)


@router.put("/{carrito_id}", response_model=ImportCarritoResponse)
def update_carrito(
    carrito_id: str,
    data: ImportCarritoUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    c = db.query(ImportCarrito).filter(ImportCarrito.id == carrito_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Carrito no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return _build_carrito_response(c, db)


@router.delete("/{carrito_id}", status_code=204)
def delete_carrito(
    carrito_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    c = db.query(ImportCarrito).filter(ImportCarrito.id == carrito_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Carrito no encontrado")
    db.delete(c)
    db.commit()


# ── Estado ────────────────────────────────────────────────────────────────────

@router.post("/{carrito_id}/estado", response_model=ImportCarritoResponse)
def cambiar_estado(
    carrito_id: str,
    estado: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    c = db.query(ImportCarrito).filter(ImportCarrito.id == carrito_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Carrito no encontrado")
    if estado not in ESTADOS_VALIDOS:
        raise HTTPException(status_code=400, detail=f"Estado inválido: {estado}")
    permitidos = TRANSICIONES.get(c.estado, [])
    if estado not in permitidos:
        raise HTTPException(
            status_code=409,
            detail=f"Transición no permitida: {c.estado} → {estado}",
        )
    c.estado = estado
    db.commit()
    db.refresh(c)
    return _build_carrito_response(c, db)


# ── Cotizar ───────────────────────────────────────────────────────────────────

@router.post("/{carrito_id}/cotizar", response_model=ImportCarritoResponse)
async def cotizar_carrito(
    carrito_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Toma el MEP actual y guarda snapshot en el carrito, cambia estado a cotizado."""
    from app.services.import_scorer.mep import get_mep_rate
    c = db.query(ImportCarrito).filter(ImportCarrito.id == carrito_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Carrito no encontrado")
    if not c.items:
        raise HTTPException(status_code=400, detail="El carrito está vacío")
    try:
        mep = await get_mep_rate()
        c.cotizacion_mep_snapshot = mep["cotizacion"]
        c.fecha_cotizacion = datetime.utcnow()
        c.estado = "cotizado"
        db.commit()
        db.refresh(c)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Error MEP: {e}")
    return _build_carrito_response(c, db)


# ── Items ─────────────────────────────────────────────────────────────────────

@router.post("/{carrito_id}/items", response_model=ImportCarritoResponse, status_code=201)
def add_item(
    carrito_id: str,
    data: ImportCarritoItemCreate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    c = db.query(ImportCarrito).filter(ImportCarrito.id == carrito_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Carrito no encontrado")
    if c.estado not in ("borrador", "cotizado"):
        raise HTTPException(status_code=409, detail="Solo se pueden agregar ítems a carritos en borrador/cotizado")
    producto = db.query(ImportProducto).filter(ImportProducto.id == data.producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    item = ImportCarritoItem(carrito_id=carrito_id, **data.model_dump())
    db.add(item)
    # Volver a borrador si estaba cotizado
    if c.estado == "cotizado":
        c.estado = "borrador"
    db.commit()
    db.refresh(c)
    return _build_carrito_response(c, db)


@router.put("/{carrito_id}/items/{item_id}", response_model=ImportCarritoResponse)
def update_item(
    carrito_id: str,
    item_id: str,
    data: ImportCarritoItemUpdate,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    item = db.query(ImportCarritoItem).filter(
        ImportCarritoItem.id == item_id,
        ImportCarritoItem.carrito_id == carrito_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    c = db.query(ImportCarrito).filter(ImportCarrito.id == carrito_id).first()
    return _build_carrito_response(c, db)


@router.delete("/{carrito_id}/items/{item_id}", response_model=ImportCarritoResponse)
def remove_item(
    carrito_id: str,
    item_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    item = db.query(ImportCarritoItem).filter(
        ImportCarritoItem.id == item_id,
        ImportCarritoItem.carrito_id == carrito_id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Ítem no encontrado")
    c = db.query(ImportCarrito).filter(ImportCarrito.id == carrito_id).first()
    db.delete(item)
    if c and c.estado == "cotizado":
        c.estado = "borrador"
    db.commit()
    return _build_carrito_response(c, db)


# ── Knapsack optimizer ────────────────────────────────────────────────────────

@router.post("/optimizar")
def optimizar(
    rubro_id: Optional[str] = None,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """
    Sugiere la combinación óptima de productos para un carrito usando config global.
    """
    from app.models.import_scorer.producto import ImportProducto as P
    from app.services.import_scorer.knapsack import optimizar_carrito

    config = db.query(ImportConfig).first()
    peso_max = config.peso_maximo_envio if config else 60.0
    capital_max = config.capital_maximo_envio if config else 2000.0
    peso_min = config.peso_minimo_envio if config else 15.0

    q = db.query(P).filter(P.descartado == False, P.semaforo.in_(["verde", "amarillo"]))
    if rubro_id:
        q = q.filter(P.rubro_id == rubro_id)
    productos = q.all()

    productos_data = [
        {
            "id": p.id,
            "nombre": p.nombre,
            "costo_puesto_usd": p.costo_puesto_usd,
            "mejor_precio_usd": p.mejor_precio_usd,
            "peso_kg": p.peso_kg,
            "ratio_margen": p.ratio_margen,
            "semaforo": p.semaforo,
            "descartado": p.descartado,
            "cantidad_sugerida": p.cantidad_sugerida,
        }
        for p in productos
    ]

    return optimizar_carrito(productos_data, peso_max, capital_max, peso_min)


# ── Generar lista de caza ─────────────────────────────────────────────────────

@router.post("/{carrito_id}/generar-lista-caza")
def generar_lista_caza(
    carrito_id: str,
    db: Session = Depends(get_db),
    _: bool = Depends(verify_admin),
):
    """Genera una lista de caza a partir de los ítems modo_compra=outlet del carrito."""
    from app.models.import_scorer.lista_caza import ImportListaCaza
    from app.models.import_scorer.outlet import ImportOutlet

    c = db.query(ImportCarrito).filter(ImportCarrito.id == carrito_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Carrito no encontrado")

    items_outlet = [i for i in c.items if i.modo_compra == "outlet"]
    if not items_outlet:
        raise HTTPException(status_code=400, detail="No hay ítems modo outlet en este carrito")

    config = db.query(ImportConfig).first()
    umbral = config.umbral_lista_caza_usd if config else 200.0

    productos_lista = []
    total_usd = 0.0
    for i in items_outlet:
        p = db.query(ImportProducto).filter(ImportProducto.id == i.producto_id).first()
        costo = i.precio_usd_locked * i.cantidad
        total_usd += costo
        productos_lista.append({
            "producto_id": i.producto_id,
            "nombre": p.nombre if p else "",
            "cantidad": i.cantidad,
            "precio_objetivo_usd": i.precio_usd_locked,
            "costo_estimado_total_usd": round(costo, 2),
            "peso_kg": i.peso_kg_locked,
            "outlet_esperado_id": i.outlet_esperado_id,
        })

    # Recomendar outlets activos
    outlets = db.query(ImportOutlet).filter(ImportOutlet.activo == True).all()
    outlets_ids = [o.id for o in outlets[:3]]

    lista = ImportListaCaza(
        carrito_origen_id=carrito_id,
        productos=productos_lista,
        total_estimado_usd=round(total_usd, 2),
        outlets_recomendados_ids=outlets_ids,
    )
    db.add(lista)
    db.commit()
    db.refresh(lista)
    return {"lista_caza_id": lista.id, "total_estimado_usd": lista.total_estimado_usd}
