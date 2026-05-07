"""Scraper Mercado Libre Argentina para Import Scorer (usa ML API pública)."""
import logging
import re
import httpx
from sqlalchemy.orm import Session

from app.models.import_scorer.producto import ImportProducto, ImportHistorico
from app.models.import_scorer.rubro import ImportRubro

logger = logging.getLogger(__name__)
ML_API = "https://api.mercadolibre.com"
HEADERS = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}


async def scrape_rubro(rubro: ImportRubro, db: Session) -> dict:
    if not rubro.ml_category_id and not rubro.ml_listado_url:
        return {"actualizados": 0, "error": "sin_categoria_ml"}

    items = []
    async with httpx.AsyncClient(timeout=30, headers=HEADERS) as client:
        if rubro.ml_category_id:
            items = await _fetch_by_category(client, rubro.ml_category_id, rubro.top_n_scraping)
        else:
            items = await _fetch_by_url(client, rubro.ml_listado_url, rubro.top_n_scraping)

    # Aplicar blacklist
    blacklist = [w.lower() for w in (rubro.blacklist_palabras or [])]
    if blacklist:
        items = [
            i for i in items
            if not any(b in i.get("title", "").lower() for b in blacklist)
        ]

    # Aplicar filtro vendidos mínimo
    if rubro.filtro_vendidos_min:
        items = [i for i in items if (i.get("sold_quantity") or 0) >= rubro.filtro_vendidos_min]

    actualizados = 0
    for idx, item in enumerate(items):
        try:
            _upsert_producto(db, rubro, item, posicion=idx + 1, total=len(items))
            actualizados += 1
        except Exception as e:
            logger.error(f"Error upsert ML {item.get('id')}: {e}")

    db.commit()
    return {"actualizados": actualizados, "total_items": len(items)}


async def _fetch_by_category(client, category_id: str, limit: int) -> list:
    results, offset = [], 0
    limit = min(limit, 200)
    while len(results) < limit:
        batch = min(50, limit - len(results))
        try:
            r = await client.get(
                f"{ML_API}/sites/MLA/search",
                params={"category": category_id, "sort": "relevance", "limit": batch, "offset": offset},
            )
            r.raise_for_status()
            data = r.json()
            chunk = data.get("results", [])
            if not chunk:
                break
            results.extend(chunk)
            offset += len(chunk)
            if offset >= data.get("paging", {}).get("total", 0):
                break
        except Exception as e:
            logger.error(f"ML category fetch error: {e}")
            break
    return results[:limit]


async def _fetch_by_url(client, url: str, limit: int) -> list:
    # Caso 1: ya tiene ID numérico /c/MLA####
    cat = re.search(r'[/_](MLA\d+)', url)
    if cat:
        return await _fetch_by_category(client, cat.group(1), limit)

    # Caso 2: slug de texto (ej: mercadolibre.com.ar/c/celulares-y-telefonos)
    # Seguimos el redirect y extraemos el ID de la URL final
    if 'mercadolibre.com' in url:
        try:
            r = await client.get(url, follow_redirects=True)
            final_url = str(r.url)
            cat = re.search(r'[/_](MLA\d+)', final_url)
            if cat:
                logger.info(f"Slug resuelto → {cat.group(1)} desde {url}")
                return await _fetch_by_category(client, cat.group(1), limit)
            # Si no encontramos ID en la URL final, intentamos extraer por búsqueda de keyword
            slug = re.search(r'/c/([^/?#]+)', url)
            if slug:
                keywords = slug.group(1).replace('-', ' ')
                r2 = await client.get(
                    f"{ML_API}/sites/MLA/search",
                    params={"q": keywords, "limit": 1},
                )
                r2.raise_for_status()
                category_id = r2.json().get("results", [{}])[0].get("category_id")
                if category_id:
                    logger.info(f"Categoría resuelta por keyword → {category_id}")
                    return await _fetch_by_category(client, category_id, limit)
        except Exception as e:
            logger.error(f"ML slug resolve error: {e}")

    # Caso 3: búsqueda por query string ?q=
    q = re.search(r'[?&]q=([^&]+)', url)
    if q:
        try:
            r = await client.get(
                f"{ML_API}/sites/MLA/search",
                params={"q": q.group(1), "limit": min(limit, 50)},
            )
            r.raise_for_status()
            return r.json().get("results", [])
        except Exception as e:
            logger.error(f"ML URL fetch error: {e}")

    return []


def _upsert_producto(db: Session, rubro: ImportRubro, item: dict, posicion: int, total: int):
    ml_url = item.get("permalink", "")
    nombre = item.get("title", "")
    precio_ars = float(item.get("price") or 0)
    vendidos = item.get("sold_quantity") or 0
    imagen = item.get("thumbnail", "")

    producto = db.query(ImportProducto).filter(
        ImportProducto.ml_url == ml_url,
        ImportProducto.rubro_id == rubro.id,
    ).first()

    precio_anterior = producto.ml_precio_ars if producto else None

    if not producto:
        producto = ImportProducto(nombre=nombre, rubro_id=rubro.id)
        db.add(producto)

    producto.nombre = nombre
    producto.ml_url = ml_url
    producto.ml_precio_ars = precio_ars
    producto.ml_vendidos = vendidos
    producto.ml_posicion_ranking = posicion
    producto.ml_total_competidores = total
    if imagen:
        producto.imagen_url = imagen

    db.flush()

    if precio_anterior != precio_ars:
        db.add(ImportHistorico(
            producto_id=producto.id,
            ml_precio_ars=precio_ars,
            ml_vendidos=vendidos,
        ))
