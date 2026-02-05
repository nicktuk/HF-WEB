"""
Scraper for sina.com.ar

Este scraper usa la API REST de Sina directamente.
No requiere browser/Playwright.

API Base: https://apisina-v1.leren.com.ar
Auth: JWT token en header x-api-token
"""
from typing import Optional, Dict, List, Callable, Any
import re
import json
import logging
import asyncio
import os

from app.scrapers.base import BaseScraper, ScrapedProduct
from app.core.exceptions import ScraperError

logger = logging.getLogger(__name__)


class SinaScraper(BaseScraper):
    """Scraper for sina.com.ar using REST API."""

    API_BASE = "https://apisina-v1.leren.com.ar"
    LOGIN_URL = f"{API_BASE}/auth/login"

    # Known categories to scrape
    CATEGORIES = [
        "Limpieza",
        "Descartables",
        "Bazar",
        "Perfumeria",
        "Alimentos",
        "Ferreteria",
        "Indumentaria",
        "Libreria",
        "Jugueteria",
        "Electronica",
        "Hogar",
        "Jardin",
        "Mascotas",
        "Automotor",
        "Textil",
    ]

    def __init__(self, http_client=None):
        super().__init__(http_client)
        self._token: Optional[str] = None

    @property
    def source_name(self) -> str:
        return "sina"

    @property
    def rate_limit_delay(self) -> float:
        return 0.5  # API is fast, can go quicker

    @property
    def default_headers(self) -> Dict[str, str]:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "es-AR,es;q=0.9",
            "Content-Type": "application/json",
            "Origin": "https://www.sina.com.ar",
            "Referer": "https://www.sina.com.ar/",
        }
        if self._token:
            headers["x-api-token"] = self._token
        return headers

    async def _login(self, config: Optional[Dict] = None) -> str:
        """Login and get JWT token."""
        if self._token:
            return self._token

        # Get credentials
        username = (config.get("username") if config else None) or os.environ.get('SINA_USERNAME')
        password = (config.get("password") if config else None) or os.environ.get('SINA_PASSWORD')

        if not username or not password:
            raise ScraperError(
                "Sina requires SINA_USERNAME and SINA_PASSWORD env vars",
                source=self.source_name
            )

        client = await self.get_client()

        try:
            logger.info("[Sina] Logging in via API...")
            print("[Sina] Logging in via API...")

            response = await client.post(
                self.LOGIN_URL,
                json={"email": username, "password": password},
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "Origin": "https://www.sina.com.ar",
                    "Referer": "https://www.sina.com.ar/",
                }
            )
            response.raise_for_status()
            data = response.json()

            # Extract token from response
            token = data.get("token") or data.get("access_token") or data.get("data", {}).get("token")

            if not token:
                # Try to find token in response
                if isinstance(data, dict):
                    for key, value in data.items():
                        if isinstance(value, str) and len(value) > 50 and "." in value:
                            token = value
                            break

            if not token:
                logger.error(f"[Sina] Login response: {data}")
                raise ScraperError("Could not extract token from login response", source=self.source_name)

            self._token = token
            logger.info("[Sina] Login successful!")
            print("[Sina] Login successful!")
            return token

        except Exception as e:
            logger.error(f"[Sina] Login failed: {e}")
            raise ScraperError(f"Login failed: {e}", source=self.source_name)

    async def _get_category_products(self, category: str, config: Optional[Dict] = None) -> List[Dict]:
        """Get all products from a category."""
        await self._login(config)
        client = await self.get_client()

        url = f"{self.API_BASE}/producto/categoriapadre/{category}"

        try:
            response = await client.get(url, headers=self.default_headers)
            response.raise_for_status()
            data = response.json()

            # Handle different response structures
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return data.get("data", []) or data.get("productos", []) or data.get("items", []) or []
            return []

        except Exception as e:
            logger.warning(f"[Sina] Error getting category {category}: {e}")
            return []

    async def scrape_catalog(self, config: Optional[Dict] = None) -> List[str]:
        """Get all product IDs from catalog."""
        all_ids = set()

        for category in self.CATEGORIES:
            products = await self._get_category_products(category, config)
            for p in products:
                pid = p.get("id") or p.get("producto_id") or p.get("cod")
                if pid:
                    all_ids.add(str(pid))
            await asyncio.sleep(self.rate_limit_delay)

        return list(all_ids)

    async def scrape_all_products(
        self,
        config: Optional[Dict] = None,
        on_product: Optional[Callable[[ScrapedProduct, int, int], Any]] = None,
        on_progress: Optional[Callable[[int, int], None]] = None
    ) -> List[ScrapedProduct]:
        """Scrape all products from all categories."""
        await self._login(config)

        logger.info("[Sina] Fetching products from all categories...")
        print("[Sina] Fetching products from all categories...")

        all_products = []
        seen_ids = set()

        for cat_idx, category in enumerate(self.CATEGORIES):
            logger.info(f"[Sina] Fetching category: {category}")
            print(f"[Sina] Fetching category {cat_idx + 1}/{len(self.CATEGORIES)}: {category}")

            products_data = await self._get_category_products(category, config)

            for p in products_data:
                pid = str(p.get("id") or p.get("producto_id") or p.get("cod") or "")
                if not pid or pid in seen_ids:
                    continue
                seen_ids.add(pid)

                product = self._parse_product(p, category)
                if product:
                    all_products.append(product)
                    if on_product:
                        on_product(product, len(all_products), 0)

            if on_progress:
                on_progress(cat_idx + 1, len(self.CATEGORIES))

            await asyncio.sleep(self.rate_limit_delay)

        logger.info(f"[Sina] Total products found: {len(all_products)}")
        print(f"[Sina] Total products found: {len(all_products)}")

        return all_products

    async def scrape_product(self, identifier: str, config: Optional[Dict] = None) -> ScrapedProduct:
        """Scrape a single product by ID."""
        await self._login(config)
        client = await self.get_client()

        # Try to get product detail
        url = f"{self.API_BASE}/producto/{identifier}"

        try:
            response = await client.get(url, headers=self.default_headers)
            response.raise_for_status()
            data = response.json()

            if isinstance(data, dict) and "data" in data:
                data = data["data"]

            product = self._parse_product(data, "")
            if product:
                return product

        except Exception as e:
            logger.error(f"[Sina] Error getting product {identifier}: {e}")

        raise ScraperError(f"Could not fetch product {identifier}", source=self.source_name)

    def _parse_product(self, data: Dict, category: str) -> Optional[ScrapedProduct]:
        """Parse product data from API response."""
        try:
            # Extract basic info
            pid = str(data.get("id") or data.get("producto_id") or data.get("cod") or "")
            name = data.get("nombre") or data.get("name") or data.get("descripcion") or ""

            if not name:
                return None

            # Price
            price = None
            price_val = data.get("precio") or data.get("price") or data.get("precio_venta")
            if price_val:
                try:
                    price = float(str(price_val).replace(",", ".").replace("$", "").strip())
                except:
                    pass

            # SKU/Code
            sku = str(data.get("codigo") or data.get("cod") or data.get("sku") or pid)

            # Images
            images = []
            img = data.get("imagen") or data.get("image") or data.get("foto")
            if img:
                if not img.startswith("http"):
                    img = f"https://apisina-v1.leren.com.ar{img}" if img.startswith("/") else f"https://apisina-v1.leren.com.ar/{img}"
                images.append(img)

            # Additional images
            for key in ["imagenes", "images", "fotos", "galeria"]:
                if key in data and isinstance(data[key], list):
                    for img_item in data[key]:
                        img_url = img_item if isinstance(img_item, str) else img_item.get("url") or img_item.get("imagen")
                        if img_url and img_url not in images:
                            if not img_url.startswith("http"):
                                img_url = f"https://apisina-v1.leren.com.ar{img_url}" if img_url.startswith("/") else f"https://apisina-v1.leren.com.ar/{img_url}"
                            images.append(img_url)

            # Min purchase quantity
            min_qty = None
            min_val = data.get("cantidad_minima") or data.get("minimo") or data.get("min_qty") or data.get("bulto")
            if min_val:
                try:
                    min_qty = int(min_val)
                except:
                    pass

            # Kit content
            kit_content = data.get("contenido") or data.get("kit_content") or data.get("detalle")
            if isinstance(kit_content, list):
                kit_content = ", ".join(str(x) for x in kit_content)

            # Description
            description = data.get("descripcion_larga") or data.get("description") or data.get("detalle")

            # Brand
            brand = data.get("marca") or data.get("brand")

            # Category from data or parameter
            cat = data.get("categoria") or data.get("category") or data.get("rubro") or category

            # Generate slug
            slug = f"prod-{sku}" if sku else f"prod-sina-{pid}"

            return ScrapedProduct(
                slug=slug,
                name=name,
                price=price,
                currency="ARS",
                description=description,
                short_description=description[:200] if description and len(description) > 200 else description,
                brand=brand,
                sku=sku,
                min_purchase_qty=min_qty,
                kit_content=kit_content,
                images=images[:5],
                categories=[cat] if cat else [],
                source_url=f"https://www.sina.com.ar/producto/{pid}",
            )

        except Exception as e:
            logger.warning(f"[Sina] Error parsing product: {e}")
            return None


# Register the scraper
from app.scrapers.registry import ScraperRegistry
ScraperRegistry.register(SinaScraper)
