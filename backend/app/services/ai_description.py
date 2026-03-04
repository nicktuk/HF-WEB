"""
Servicio de generación de descripciones cortas usando IA (Claude o OpenAI).

Pipeline por producto:
  1. Datos internos del producto
  2. Re-fetch de la URL origen (proveedor)
  3. Búsqueda web con Brave Search
  4. Análisis de imagen (visión)
  5. Llamada al LLM → short_description
  6. Guardado en DB
"""
import asyncio
import base64
import uuid
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import SessionLocal
from app.models.product import Product


# ---------------------------------------------------------------------------
# Estado de un job de generación
# ---------------------------------------------------------------------------

@dataclass
class JobState:
    job_id: str
    status: str = "running"   # running | completed | cancelled
    total: int = 0
    processed: int = 0
    success: int = 0
    failed: int = 0
    errors: List[Dict] = field(default_factory=list)
    results: List[Dict] = field(default_factory=list)


# Registro global de jobs (en memoria)
_jobs: Dict[str, JobState] = {}


def get_jobs() -> Dict[str, JobState]:
    return _jobs


# ---------------------------------------------------------------------------
# Servicio
# ---------------------------------------------------------------------------

PROMPT_TEMPLATE = """\
Sos un experto en marketing y redacción de fichas de producto para una tienda \
de electrónica y tecnología en Argentina.

Basándote en la siguiente información del producto, escribí una descripción \
corta de venta de 2 a 3 oraciones (máximo 160 palabras).

La descripción debe:
- Destacar las características más importantes y el beneficio principal
- Estar en español argentino, tono directo y comercial
- NO inventar especificaciones que no aparezcan en la info provista
- NO incluir precio ni referencias a stock
- Ser concisa y atractiva para un comprador online

{context}

Respondé SOLO con la descripción, sin título, sin viñetas, sin formato extra."""


class AIDescriptionService:

    def __init__(self) -> None:
        self._http = httpx.AsyncClient(timeout=12.0, follow_redirects=True)

    # ------------------------------------------------------------------
    # Punto de entrada principal: genera para un producto
    # ------------------------------------------------------------------

    async def generate_for_product(
        self,
        product: Product,
        use_search: bool = True,
        use_vision: bool = True,
        use_source_refetch: bool = True,
        config: Optional[Dict] = None,
    ) -> str:
        cfg = config or {}
        context_parts: List[str] = []

        name = product.custom_name or product.original_name
        context_parts.append(f"Producto: {name}")

        if product.brand:
            context_parts.append(f"Marca: {product.brand}")
        if product.sku:
            context_parts.append(f"Código/SKU: {product.sku}")
        cat = product.category_ref.name if product.category_ref else product.category
        if cat:
            context_parts.append(f"Categoría: {cat}")
        if product.subcategory:
            context_parts.append(f"Subcategoría: {product.subcategory}")
        if product.kit_content:
            context_parts.append(f"Contenido: {product.kit_content[:300]}")
        if product.description:
            context_parts.append(f"Descripción base: {product.description[:500]}")

        # Imagen primaria
        image_url: Optional[str] = None
        if product.images:
            primary = next((i for i in product.images if i.is_primary), product.images[0])
            image_url = primary.url

        # Re-fetch URL origen
        if use_source_refetch and product.source_url:
            source_text = await self._fetch_source_url(product.source_url)
            if source_text:
                context_parts.append(f"Info del proveedor: {source_text}")

        # Búsqueda web
        brave_key = cfg.get("BRAVE_SEARCH_API_KEY") or settings.BRAVE_SEARCH_API_KEY
        if use_search and brave_key:
            query = f"{name} {product.brand or ''}".strip()
            web_text = await self._search_web(query, brave_key)
            if web_text:
                context_parts.append(f"Info web: {web_text}")

        context = "\n".join(context_parts)
        vision_url = image_url if (use_vision and settings.AI_VISION_ENABLED) else None

        provider = cfg.get("AI_PROVIDER") or settings.AI_PROVIDER
        if provider == "openai":
            return await self._call_openai(context, vision_url, cfg)
        return await self._call_claude(context, vision_url, cfg)

    # ------------------------------------------------------------------
    # Fetch URL origen
    # ------------------------------------------------------------------

    async def _fetch_source_url(self, url: str) -> Optional[str]:
        try:
            resp = await self._http.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; HefaBot/1.0)"},
            )
            if resp.status_code != 200:
                return None
            soup = BeautifulSoup(resp.text, "lxml")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            # Intentar extraer la sección más relevante
            for selector in [
                "[class*='descripcion']", "[class*='description']",
                "[class*='detalle']", "[class*='detail']",
                "[class*='especificacion']", "[class*='spec']",
                "main", "article", ".product-info",
            ]:
                el = soup.select_one(selector)
                if el:
                    text = el.get_text(separator=" ", strip=True)
                    if len(text) > 50:
                        return text[:600]
            return soup.get_text(separator=" ", strip=True)[:400]
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Brave Search
    # ------------------------------------------------------------------

    async def _search_web(self, query: str, brave_key: Optional[str] = None) -> Optional[str]:
        api_key = brave_key or settings.BRAVE_SEARCH_API_KEY
        try:
            resp = await self._http.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={"q": query, "count": 3, "country": "ar", "search_lang": "es"},
                headers={
                    "Accept": "application/json",
                    "X-Subscription-Token": api_key,
                },
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            snippets = [
                r.get("description", "")
                for r in data.get("web", {}).get("results", [])[:3]
                if r.get("description")
            ]
            return " | ".join(snippets)[:500] or None
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Claude
    # ------------------------------------------------------------------

    async def _call_claude(self, context: str, image_url: Optional[str], config: Optional[Dict] = None) -> str:
        try:
            import anthropic
        except ImportError:
            raise RuntimeError("Paquete 'anthropic' no instalado. Ejecutá: pip install anthropic")

        cfg = config or {}
        api_key = cfg.get("ANTHROPIC_API_KEY") or settings.ANTHROPIC_API_KEY
        client = anthropic.AsyncAnthropic(api_key=api_key)
        content: List[Dict] = []

        if image_url:
            img_data = await self._fetch_image_b64(image_url)
            if img_data:
                content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": img_data["media_type"],
                        "data": img_data["data"],
                    },
                })

        content.append({"type": "text", "text": PROMPT_TEMPLATE.format(context=context)})

        response = await client.messages.create(
            model=settings.AI_MODEL_CLAUDE,
            max_tokens=300,
            messages=[{"role": "user", "content": content}],
        )
        return response.content[0].text.strip()

    # ------------------------------------------------------------------
    # OpenAI
    # ------------------------------------------------------------------

    async def _call_openai(self, context: str, image_url: Optional[str], config: Optional[Dict] = None) -> str:
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise RuntimeError("Paquete 'openai' no instalado. Ejecutá: pip install openai")

        cfg = config or {}
        api_key = cfg.get("OPENAI_API_KEY") or settings.OPENAI_API_KEY
        client = AsyncOpenAI(api_key=api_key)
        content: List[Dict] = []

        if image_url:
            content.append({
                "type": "image_url",
                "image_url": {"url": image_url, "detail": "low"},
            })

        content.append({"type": "text", "text": PROMPT_TEMPLATE.format(context=context)})

        response = await client.chat.completions.create(
            model=settings.AI_MODEL_OPENAI,
            max_tokens=300,
            messages=[{"role": "user", "content": content}],
        )
        return (response.choices[0].message.content or "").strip()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    async def _fetch_image_b64(self, url: str) -> Optional[Dict]:
        try:
            resp = await self._http.get(url)
            if resp.status_code != 200:
                return None
            media_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
            if media_type not in ("image/jpeg", "image/png", "image/webp", "image/gif"):
                media_type = "image/jpeg"
            return {
                "media_type": media_type,
                "data": base64.standard_b64encode(resp.content).decode(),
            }
        except Exception:
            return None

    # ------------------------------------------------------------------
    # Batch job (llamado como BackgroundTask de FastAPI)
    # ------------------------------------------------------------------

    async def run_batch_job(
        self,
        job_id: str,
        product_ids: List[int],
        use_search: bool,
        use_vision: bool,
        use_source_refetch: bool,
        config: Optional[Dict] = None,
    ) -> None:
        job = _jobs[job_id]
        job.total = len(product_ids)
        cfg = config or {}
        concurrency = cfg.get("AI_BATCH_CONCURRENCY") or settings.AI_BATCH_CONCURRENCY
        semaphore = asyncio.Semaphore(concurrency)

        async def process_one(product_id: int) -> None:
            async with semaphore:
                db: Session = SessionLocal()
                name = f"Producto #{product_id}"
                try:
                    product = (
                        db.query(Product)
                        .filter(Product.id == product_id)
                        .first()
                    )
                    if not product:
                        job.failed += 1
                        job.errors.append({"id": product_id, "name": name, "error": "No encontrado"})
                        return

                    name = product.custom_name or product.original_name

                    desc = await self.generate_for_product(
                        product, use_search, use_vision, use_source_refetch, config=cfg
                    )
                    product.short_description = desc[:1000]
                    db.commit()

                    job.success += 1
                    # Guardar últimos 60 resultados para mostrar en UI
                    job.results.append({"id": product_id, "name": name, "description": desc})
                    if len(job.results) > 60:
                        job.results.pop(0)

                except Exception as exc:
                    db.rollback()
                    job.failed += 1
                    job.errors.append({"id": product_id, "name": name, "error": str(exc)[:250]})
                finally:
                    db.close()
                    job.processed += 1

        # Procesar en chunks con delay entre ellos para no saturar las APIs
        chunk_size = concurrency * 4
        for i in range(0, len(product_ids), chunk_size):
            if job.status == "cancelled":
                break
            chunk = product_ids[i: i + chunk_size]
            await asyncio.gather(*[process_one(pid) for pid in chunk])
            if i + chunk_size < len(product_ids):
                await asyncio.sleep(settings.AI_BATCH_CHUNK_DELAY)

        if job.status != "cancelled":
            job.status = "completed"

    async def close(self) -> None:
        await self._http.aclose()


# ---------------------------------------------------------------------------
# Singleton
# ---------------------------------------------------------------------------

_instance: Optional[AIDescriptionService] = None


def get_ai_service() -> AIDescriptionService:
    global _instance
    if _instance is None:
        _instance = AIDescriptionService()
    return _instance
