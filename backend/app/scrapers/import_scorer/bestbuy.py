"""Scraper Best Buy USA via API oficial (developers.bestbuy.com)."""
import logging
from sqlalchemy.orm import Session

from app.config import settings
from app.models.import_scorer.producto import ImportProducto, ImportOfertaRetailer
from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.retailer import ImportRetailer
from app.scrapers.import_scorer.utils import get_client

logger = logging.getLogger(__name__)
BB_API = "https://api.bestbuy.com/v1/products"


async def scrape_rubro(rubro: ImportRubro, retailer: ImportRetailer, db: Session) -> dict:
    if not settings.BESTBUY_API_KEY:
        logger.warning("BESTBUY_API_KEY no configurada — saltando Best Buy")
        return {"actualizados": 0, "error": "sin_api_key"}

    total = 0
    for termino in (rubro.palabras_busqueda_usa or []):
        try:
            productos = await _buscar(termino)
            for p in productos:
                _upsert_oferta(db, rubro, retailer, p)
                total += 1
        except Exception as e:
            logger.error(f"Best Buy error '{termino}': {e}")
            retailer.ultimo_error = str(e)[:500]
    db.commit()
    return {"actualizados": total}


async def _buscar(query: str) -> list:
    params = {
        "apiKey": settings.BESTBUY_API_KEY,
        "format": "json",
        "show": "name,regularPrice,salePrice,customerReviewAverage,customerReviewCount,bestSellingRank,url,thumbnailImage,inStoreAvailability,onlineAvailability",
        "pageSize": "20",
        "sort": "bestSellingRank.asc",
        "q": query,
    }
    results = []
    async with get_client(timeout=20, extra_headers={"Accept": "application/json"}) as client:
        try:
            r = await client.get(BB_API, params=params)
            r.raise_for_status()
            for item in r.json().get("products", []):
                price = item.get("salePrice") or item.get("regularPrice") or 0
                if not price:
                    continue
                results.append({
                    "nombre": item.get("name", ""),
                    "precio_usd": float(price),
                    "precio_regular_usd": float(item.get("regularPrice") or price),
                    "url": item.get("url", ""),
                    "imagen_url": item.get("thumbnailImage", ""),
                    "en_stock": item.get("onlineAvailability", False),
                    "rating": item.get("customerReviewAverage"),
                    "reviews": item.get("customerReviewCount"),
                    "bestselling_rank": item.get("bestSellingRank"),
                })
        except Exception as e:
            logger.warning(f"Best Buy API error: {e}")
    return results


def _upsert_oferta(db: Session, rubro: ImportRubro, retailer: ImportRetailer, data: dict):
    nombre, url = data.get("nombre", ""), data.get("url", "")
    if not nombre:
        return

    producto = (
        db.query(ImportProducto)
        .filter(ImportProducto.rubro_id == rubro.id, ImportProducto.nombre == nombre)
        .first()
    )
    if not producto:
        producto = ImportProducto(nombre=nombre, rubro_id=rubro.id, imagen_url=data.get("imagen_url"))
        db.add(producto)
        db.flush()

    oferta = (
        db.query(ImportOfertaRetailer)
        .filter(ImportOfertaRetailer.producto_id == producto.id, ImportOfertaRetailer.retailer_id == retailer.id)
        .first()
    )
    if not oferta:
        oferta = ImportOfertaRetailer(producto_id=producto.id, retailer_id=retailer.id, url=url)
        db.add(oferta)

    oferta.precio_usd = data["precio_usd"]
    oferta.url = url
    oferta.en_stock = data.get("en_stock", True)

    if not producto.mejor_precio_usd or data["precio_usd"] < producto.mejor_precio_usd:
        producto.mejor_precio_usd = data["precio_usd"]
        producto.mejor_retailer_id = retailer.id
        producto.mejor_precio_url = url
