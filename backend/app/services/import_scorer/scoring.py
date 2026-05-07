"""Servicio de scoring: recalcula costos y semáforo para productos activos."""
import logging
from sqlalchemy.orm import Session

from app.models.import_scorer.producto import ImportProducto
from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.config import ImportConfig
from app.models.import_scorer.retailer import ImportRetailer
from app.services.import_scorer.calculations import (
    calcular_costo_puesto,
    calcular_ratio_margen,
    calcular_semaforo,
)

logger = logging.getLogger(__name__)


async def recalcular_scoring(db: Session, cotizacion_mep: float) -> dict:
    """
    Recalcula costo_puesto, ratio_margen y semáforo para todos los productos no descartados.
    Usa parámetros del rubro cuando existen, o de la config global como fallback.
    """
    config = db.query(ImportConfig).first()
    costo_flete_global = config.costo_flete_usd_por_kg if config else 50.0
    sales_tax_global = config.sales_tax_fl if config else 0.07

    productos = (
        db.query(ImportProducto)
        .filter(ImportProducto.descartado == False)
        .all()
    )

    rubros_cache: dict = {}
    retailers_cache: dict = {}
    actualizados = 0
    sin_datos = 0

    for producto in productos:
        if not producto.mejor_precio_usd or not producto.peso_kg or not producto.ml_precio_ars:
            sin_datos += 1
            continue

        # Cache rubro
        if producto.rubro_id not in rubros_cache:
            rubros_cache[producto.rubro_id] = (
                db.query(ImportRubro).filter(ImportRubro.id == producto.rubro_id).first()
            )
        rubro = rubros_cache.get(producto.rubro_id)

        # Cache retailer para cobra_tax_fl
        cobra_tax = True
        if producto.mejor_retailer_id:
            if producto.mejor_retailer_id not in retailers_cache:
                retailers_cache[producto.mejor_retailer_id] = (
                    db.query(ImportRetailer)
                    .filter(ImportRetailer.id == producto.mejor_retailer_id)
                    .first()
                )
            retailer = retailers_cache.get(producto.mejor_retailer_id)
            if retailer:
                cobra_tax = retailer.cobra_tax_fl

        resultado = calcular_costo_puesto(
            precio_usd=producto.mejor_precio_usd,
            peso_kg=producto.peso_kg,
            cobra_tax_fl=cobra_tax,
            sales_tax_fl=sales_tax_global,
            costo_flete_usd_por_kg=costo_flete_global,
        )

        margen_verde = rubro.margen_minimo_verde if rubro else 2.5
        margen_amarillo = rubro.margen_minimo_amarillo if rubro else 1.8

        ratio = calcular_ratio_margen(
            precio_venta_ars=producto.ml_precio_ars,
            costo_puesto_usd=resultado["costo_puesto_usd"],
            cotizacion_mep=cotizacion_mep,
        )
        semaforo = calcular_semaforo(ratio, margen_verde, margen_amarillo)

        producto.sales_tax_usd = resultado["sales_tax_usd"]
        producto.costo_flete_usd = resultado["costo_flete_usd"]
        producto.costo_puesto_usd = resultado["costo_puesto_usd"]
        producto.ratio_margen = ratio
        producto.semaforo = semaforo
        actualizados += 1

    db.commit()
    logger.info(f"Scoring recalculado: {actualizados} actualizados, {sin_datos} sin datos")
    return {
        "actualizados": actualizados,
        "sin_datos": sin_datos,
        "total": len(productos),
        "cotizacion_mep_usada": cotizacion_mep,
    }
