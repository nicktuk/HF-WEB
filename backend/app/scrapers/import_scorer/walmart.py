"""Scraper Walmart USA para Import Scorer."""
import json
import logging
import re
import httpx
from sqlalchemy.orm import Session

from app.models.import_scorer.producto import ImportProducto, ImportOfertaRetailer
from app.models.import_scorer.rubro import ImportRubro
from app.models.import_scorer.retailer import ImportRetailer

from app.scrapers.import_scorer.utils import get_client

logger = logging.getLogger(__name__)


async def scrape_rubro(rubro: ImportRubro, retailer: ImportRetailer, db: Session) -> dict:
    total = 0
    for termino in (rubro.palabras_busqueda_usa or []):
        try:
            productos = await _buscar(termino, retailer)
            for p in productos:
                _upsert_oferta(db, rubro, retailer, p)
                total += 1
        except Exception as e:
            logger.error(f"Walmart error '{termino}': {e}")
            retailer.ultimo_error = str(e)[:500]
    db.commit()
    return {"actualizados": total}


async def _buscar(query: str, retailer: ImportRetailer) -> list:
    url = retailer.search_url_template.replace("{query}", query.replace(" ", "+"))
    results = []
    async with get_client(timeout=20) as client:
        try:
            r = await client.get(url)
            r.raise_for_status()
            m = re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', r.text, re.DOTALL)
            if m:
                data = json.loads(m.group(1))
                stacks = (
                    data.get("props", {})
                    .get("pageProps", {})
                    .get("initialData", {})
                    .get("searchResult", {})
                    .get("itemStacks", [])
                )
                items = stacks[0].get("items", []) if stacks else []
                for item in items[:20]:
                    price = item.get("price", {})
                    p_usd = (
                        price.get("currentPrice", {}).get("price")
                        or price.get("price")
                        or 0
                    )
                    if not p_usd:
                        continue
                    results.append({
                        "nombre": item.get("name", ""),
                        "precio_usd": float(p_usd),
                        "url": f"https://www.walmart.com{item.get('canonicalUrl', '')}",
                        "en_stock": not item.get("isOutOfStock", False),
                        "imagen_url": item.get("imageInfo", {}).get("thumbnailUrl", ""),
                    })
        except Exception as e:
            logger.warning(f"Walmart scrape error: {e}")
    return results


def _upsert_oferta(db, rubro, retailer, data):
    nombre, url = data["nombre"], data["url"]
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
