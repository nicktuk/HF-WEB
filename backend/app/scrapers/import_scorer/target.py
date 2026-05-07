"""Scraper Target USA para Import Scorer (usa RedSky API pública)."""
import logging
import httpx
from sqlalchemy.orm import Session

from app.models.import_scorer.producto import ImportProducto, ImportOfertaRetailer
from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.retailer import ImportRetailer

logger = logging.getLogger(__name__)
REDSKY = "https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
    "Origin": "https://www.target.com",
    "Referer": "https://www.target.com/",
}
REDSKY_KEY = "9f36aeafbe60771e321a7cc95a78140772ab3e96"


async def scrape_rubro(rubro: ImportRubro, retailer: ImportRetailer, db: Session) -> dict:
    total = 0
    for termino in (rubro.palabras_busqueda_usa or []):
        try:
            productos = await _buscar(termino)
            for p in productos:
                _upsert_oferta(db, rubro, retailer, p)
                total += 1
        except Exception as e:
            logger.error(f"Target error '{termino}': {e}")
            retailer.ultimo_error = str(e)[:500]
    db.commit()
    return {"actualizados": total}


async def _buscar(query: str) -> list:
    results = []
    params = {
        "key": REDSKY_KEY,
        "channel": "WEB",
        "count": "20",
        "default_purchasability_filter": "true",
        "keyword": query,
        "offset": "0",
        "page": f"/s/{query.replace(' ', '-')}",
        "platform": "desktop",
        "pricing_store_id": "3991",
        "store_ids": "3991",
        "useragent": "Mozilla/5.0",
        "visitor_id": "018DB7A3EA0202018D7F3875E2BE3985",
    }
    async with httpx.AsyncClient(headers=HEADERS, timeout=20, follow_redirects=True) as client:
        try:
            r = await client.get(REDSKY, params=params)
            r.raise_for_status()
            items = r.json().get("data", {}).get("search", {}).get("products", [])
            for item in items[:20]:
                price_info = item.get("price", {})
                p_usd = price_info.get("current_retail") or price_info.get("reg_retail") or 0
                if not p_usd:
                    continue
                tcin = item.get("tcin", "")
                results.append({
                    "nombre": item.get("item", {}).get("product_description", {}).get("title", ""),
                    "precio_usd": float(p_usd),
                    "url": f"https://www.target.com/p/-/A-{tcin}" if tcin else "",
                    "en_stock": not item.get("fulfillment", {}).get("is_out_of_stock_in_all_store_locations", False),
                    "imagen_url": item.get("item", {}).get("enrichment", {}).get("images", {}).get("primary_image_url", ""),
                })
        except Exception as e:
            logger.warning(f"Target API error: {e}")
    return results


def _upsert_oferta(db, rubro, retailer, data):
    nombre, url = data.get("nombre", ""), data.get("url", "")
    if not nombre or not url:
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
