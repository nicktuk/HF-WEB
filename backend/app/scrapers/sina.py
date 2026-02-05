"""
Scraper for sina.com.ar

Este scraper está diseñado para el catálogo de Sina.
Requiere autenticación con usuario y contraseña.
La página usa Angular y carga productos dinámicamente.

NOTA: Usa Playwright para renderizar JavaScript y manejar el login.
"""
from typing import Optional, Dict, List, Callable, Any
import re
import json
import logging
import asyncio
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedProduct
from app.core.exceptions import ScraperError

logger = logging.getLogger(__name__)

# Playwright is required for this scraper
try:
    from playwright.async_api import async_playwright, Page, Browser
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("Playwright not installed. Sina scraper will not work.")


class SinaScraper(BaseScraper):
    """Scraper for sina.com.ar catalog.

    Usa Playwright para:
    1. Hacer login con usuario y contraseña
    2. Navegar por el catálogo
    3. Extraer datos de productos incluyendo cantidad mínima y contenido del kit
    """

    BASE_URL = "https://www.sina.com.ar"
    LOGIN_URL = f"{BASE_URL}/login"
    CATALOG_URL = f"{BASE_URL}/categorias"

    def __init__(self, http_client=None):
        super().__init__(http_client)
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._page: Optional[Page] = None
        self._logged_in = False

    @property
    def source_name(self) -> str:
        return "sina"

    @property
    def rate_limit_delay(self) -> float:
        return 2.0  # 2 seconds between requests

    async def _ensure_browser(self) -> Page:
        """Ensure browser is launched and return a page."""
        if not PLAYWRIGHT_AVAILABLE:
            raise ScraperError(
                "Playwright is required for Sina scraper",
                source=self.source_name
            )

        if self._page is None:
            import os
            self._playwright = await async_playwright().start()

            # Use Browserless.io cloud browser
            browserless_token = os.environ.get('BROWSERLESS_TOKEN', '')

            if browserless_token:
                browserless_url = f"wss://chrome.browserless.io?token={browserless_token}"
                logger.info("[Sina] Connecting to Browserless.io...")
                print("[Sina] Connecting to Browserless.io...")
                self._browser = await self._playwright.chromium.connect_over_cdp(browserless_url)
            else:
                # Fallback to local browser (for development)
                logger.info("[Sina] No BROWSERLESS_TOKEN, using local browser...")
                print("[Sina] No BROWSERLESS_TOKEN, using local browser...")
                self._browser = await self._playwright.chromium.launch(
                    headless=True,
                    args=['--no-sandbox', '--disable-setuid-sandbox']
                )

            self._page = await self._browser.new_page()
            await self._page.set_viewport_size({"width": 1920, "height": 1080})

        return self._page

    async def _login(self, config: Optional[Dict] = None) -> bool:
        """Login to sina.com.ar using credentials from config."""
        if self._logged_in:
            return True

        page = await self._ensure_browser()

        # Get credentials from config or environment variables
        import os
        username = (config.get("username") if config else None) or os.environ.get('SINA_USERNAME')
        password = (config.get("password") if config else None) or os.environ.get('SINA_PASSWORD')

        if not username or not password:
            raise ScraperError(
                "Sina scraper requires username and password in config or SINA_USERNAME/SINA_PASSWORD env vars",
                source=self.source_name
            )

        try:
            logger.info(f"[Sina] Navegando a login...")
            print(f"[Sina] Navegando a login...")

            await page.goto(self.BASE_URL, wait_until='domcontentloaded', timeout=60000)
            await asyncio.sleep(3)

            # Click on login button to open modal
            login_btn = page.locator('text=Iniciar sesión').first
            try:
                await login_btn.wait_for(state='visible', timeout=10000)
                await login_btn.click()
                await asyncio.sleep(2)
            except:
                logger.info("[Sina] No login button found, trying direct form...")

            # Fill login form
            email_input = page.locator('input[type="email"], input[name="email"], input[placeholder*="mail"]').first
            await email_input.wait_for(state='visible', timeout=10000)
            await email_input.fill(username)

            password_input = page.locator('input[type="password"], input[name="password"]').first
            await password_input.fill(password)

            # Submit
            submit_btn = page.locator('button[type="submit"], button:has-text("Ingresar"), button:has-text("Iniciar")').first
            await submit_btn.click()
            await asyncio.sleep(5)

            # Wait for navigation
            await page.wait_for_load_state('domcontentloaded', timeout=30000)

            # Verify login success
            content = await page.content()
            if 'cerrar sesión' in content.lower() or 'mi cuenta' in content.lower():
                self._logged_in = True
                logger.info(f"[Sina] Login exitoso!")
                print(f"[Sina] Login exitoso!")
                return True
            else:
                logger.warning(f"[Sina] Login posiblemente fallido, continuando...")
                print(f"[Sina] Login posiblemente fallido, continuando...")
                self._logged_in = True  # Try anyway
                return True

        except Exception as e:
            logger.error(f"[Sina] Error en login: {e}")
            print(f"[Sina] Error en login: {e}")
            raise ScraperError(f"Login failed: {e}", source=self.source_name)

    async def scrape_catalog(self, config: Optional[Dict] = None) -> List[str]:
        """
        Scrape all product identifiers from the catalog.

        Returns:
            List of product IDs/URLs
        """
        await self._login(config)
        page = await self._ensure_browser()

        logger.info(f"[Sina] Obteniendo catálogo...")
        print(f"[Sina] Obteniendo catálogo...")

        product_ids = set()

        try:
            # Navigate to catalog
            await page.goto(self.CATALOG_URL, wait_until='networkidle')
            await asyncio.sleep(2)

            # Scroll to load all products (infinite scroll handling)
            last_count = 0
            scroll_attempts = 0
            max_scroll_attempts = 50

            while scroll_attempts < max_scroll_attempts:
                # Get current content and extract product links
                content = await page.content()

                # Extract product IDs from URLs like /categoria/subcategoria/nombre/ID
                for match in re.finditer(r'/[^/]+/[^/]+/[^/]+/(\d+)(?:\?|$|")', content):
                    product_ids.add(match.group(1))

                current_count = len(product_ids)

                if current_count == last_count:
                    scroll_attempts += 1
                else:
                    scroll_attempts = 0
                    last_count = current_count

                # Scroll down
                await page.evaluate('window.scrollBy(0, window.innerHeight)')
                await asyncio.sleep(0.5)

                if scroll_attempts >= 3:
                    # Try clicking "ver más" if exists
                    ver_mas = page.locator('text=Ver más').first
                    if await ver_mas.is_visible():
                        await ver_mas.click()
                        await asyncio.sleep(2)
                        scroll_attempts = 0
                    else:
                        break

            logger.info(f"[Sina] Encontrados {len(product_ids)} productos")
            print(f"[Sina] Encontrados {len(product_ids)} productos")

        except Exception as e:
            logger.error(f"[Sina] Error obteniendo catálogo: {e}")
            print(f"[Sina] Error obteniendo catálogo: {e}")

        return list(product_ids)

    async def scrape_all_products(
        self,
        config: Optional[Dict] = None,
        on_product: Optional[Callable[[ScrapedProduct, int, int], Any]] = None,
        on_progress: Optional[Callable[[int, int], None]] = None
    ) -> List[ScrapedProduct]:
        """
        Scrape all products from the catalog.

        Args:
            config: Scraper configuration (must include username and password)
            on_product: Callback for each product
            on_progress: Callback for progress updates

        Returns:
            List of ScrapedProduct objects
        """
        await self._login(config)

        product_ids = await self.scrape_catalog(config)

        if not product_ids:
            raise ScraperError(
                "No products found in catalog",
                source=self.source_name
            )

        total = len(product_ids)
        products = []

        for idx, product_id in enumerate(product_ids):
            try:
                product = await self._scrape_product_detail(product_id, config)
                if product:
                    products.append(product)
                    if on_product:
                        on_product(product, idx, total)

                if (idx + 1) % 10 == 0 or idx == total - 1:
                    logger.info(f"[Sina] Procesados {idx + 1}/{total}")
                    print(f"[Sina] Procesados {idx + 1}/{total}")
                    if on_progress:
                        on_progress(idx + 1, total)

                await asyncio.sleep(self.rate_limit_delay)

            except Exception as e:
                logger.warning(f"[Sina] Error procesando producto {product_id}: {e}")
                continue

        logger.info(f"[Sina] Completado: {len(products)} productos extraídos")
        print(f"[Sina] Completado: {len(products)} productos extraídos")

        return products

    async def scrape_product(
        self,
        identifier: str,
        config: Optional[Dict] = None
    ) -> ScrapedProduct:
        """
        Scrape a single product.

        Args:
            identifier: Product ID or full URL
            config: Scraper configuration

        Returns:
            ScrapedProduct with extracted data
        """
        await self._login(config)
        product = await self._scrape_product_detail(identifier, config)
        if not product:
            raise ScraperError(
                f"Failed to scrape product {identifier}",
                source=self.source_name
            )
        return product

    async def _scrape_product_detail(
        self,
        product_id: str,
        config: Optional[Dict] = None
    ) -> Optional[ScrapedProduct]:
        """
        Scrape product details from its page.

        Args:
            product_id: Product ID (numeric)
            config: Scraper configuration

        Returns:
            ScrapedProduct or None if failed
        """
        page = await self._ensure_browser()

        # If product_id is a full URL, use it; otherwise construct URL
        if product_id.startswith('http'):
            url = product_id
        else:
            # We need to find the product URL - try API first
            url = f"{self.BASE_URL}/api/articulos/{product_id}"

        try:
            # Try to get product data from API
            api_data = await self._try_api(product_id, config)
            if api_data:
                return self._parse_api_response(api_data, product_id)

            # Fallback: navigate to product page
            # First, search for the product
            await page.goto(f"{self.BASE_URL}/?q={product_id}", wait_until='networkidle')
            await asyncio.sleep(2)

            # Look for product link
            content = await page.content()
            match = re.search(rf'/[^/]+/[^/]+/[^/]+/{product_id}(?:\?|$|")', content)

            if match:
                product_url = self.BASE_URL + match.group(0).rstrip('"')
                await page.goto(product_url, wait_until='networkidle')
                await asyncio.sleep(2)
                return await self._parse_product_page(page, product_id)

            return None

        except Exception as e:
            logger.warning(f"[Sina] Error obteniendo producto {product_id}: {e}")
            return None

    async def _try_api(self, product_id: str, config: Optional[Dict] = None) -> Optional[Dict]:
        """Try to get product data from API."""
        page = await self._ensure_browser()

        try:
            # Try different API endpoints
            endpoints = [
                f"{self.BASE_URL}/api/articulos/{product_id}",
                f"{self.BASE_URL}/api/v1/articulos/{product_id}",
                f"{self.BASE_URL}/api/productos/{product_id}",
            ]

            for endpoint in endpoints:
                response = await page.request.get(endpoint)
                if response.ok:
                    data = await response.json()
                    if data and isinstance(data, dict):
                        return data

        except Exception as e:
            logger.debug(f"[Sina] API not available: {e}")

        return None

    def _parse_api_response(self, data: Dict, product_id: str) -> ScrapedProduct:
        """Parse product data from API response."""
        name = data.get('nombre') or data.get('name') or data.get('descripcion', '')
        price = None
        price_str = data.get('precio') or data.get('price')
        if price_str:
            try:
                price = float(str(price_str).replace(',', '.'))
            except (ValueError, TypeError):
                pass

        # Extract images
        images = []
        if 'imagenes' in data:
            images = [img.get('url') or img for img in data['imagenes'] if img]
        elif 'imagen' in data:
            images = [data['imagen']]
        elif 'fotos' in data:
            images = data['fotos']

        # Extract additional fields
        sku = data.get('codigo') or data.get('sku') or data.get('cod')
        min_qty = data.get('cantidad_minima') or data.get('minimo') or data.get('min_qty')
        kit_content = data.get('contenido') or data.get('kit_content') or data.get('descripcion_kit')
        brand = data.get('marca') or data.get('brand')
        description = data.get('descripcion') or data.get('description')
        category = data.get('categoria') or data.get('category')

        # Clean and convert min_qty
        if min_qty:
            try:
                min_qty = int(min_qty)
            except (ValueError, TypeError):
                min_qty = None

        # Generate slug
        slug = f"prod-sina-{sku}" if sku else f"prod-sina-{product_id}"

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
            categories=[category] if category else [],
            source_url=f"{self.BASE_URL}/producto/{product_id}",
        )

    async def _parse_product_page(self, page: Page, product_id: str) -> Optional[ScrapedProduct]:
        """Parse product data from rendered page."""
        try:
            content = await page.content()
            soup = BeautifulSoup(content, 'lxml')

            # Extract name
            name = None
            name_selectors = ['h1', '.product-name', '.titulo', '[class*="titulo"]', '[class*="name"]']
            for selector in name_selectors:
                elem = soup.select_one(selector)
                if elem and elem.text.strip():
                    name = elem.text.strip()
                    break

            if not name:
                return None

            # Extract price
            price = None
            price_text = None
            price_selectors = [
                '.precio', '.price', '[class*="precio"]', '[class*="price"]',
                'span:contains("$")', 'div:contains("$")'
            ]
            for selector in price_selectors:
                elem = soup.select_one(selector)
                if elem:
                    price_text = elem.text.strip()
                    price = self.extract_price(price_text)
                    if price:
                        break

            # Extract images
            images = []
            for img in soup.select('img[src*="sina"], img[src*="producto"], .product-image img'):
                src = img.get('src') or img.get('data-src')
                if src and 'logo' not in src.lower():
                    if not src.startswith('http'):
                        src = self.BASE_URL + src
                    if src not in images:
                        images.append(src)

            # Extract SKU/código
            sku = None
            sku_match = re.search(r'[Cc][óo]digo[:\s]*(\w+)', content)
            if sku_match:
                sku = sku_match.group(1)

            # Extract cantidad mínima
            min_qty = None
            min_match = re.search(r'[Cc]antidad\s*[Mm][íi]nima[:\s]*(\d+)', content)
            if min_match:
                min_qty = int(min_match.group(1))
            else:
                min_match = re.search(r'[Mm][íi]nimo[:\s]*(\d+)\s*(?:unidad|u\.)', content)
                if min_match:
                    min_qty = int(min_match.group(1))

            # Extract kit content
            kit_content = None
            kit_match = re.search(r'[Cc]ontenido(?:\s+del\s+kit)?[:\s]*([^<]+)', content)
            if kit_match:
                kit_content = kit_match.group(1).strip()
                # Clean up
                kit_content = re.sub(r'\s+', ' ', kit_content)
                if len(kit_content) > 500:
                    kit_content = kit_content[:500]

            # Extract description
            description = None
            desc_selectors = ['.descripcion', '.description', '[class*="descripcion"]']
            for selector in desc_selectors:
                elem = soup.select_one(selector)
                if elem and elem.text.strip():
                    description = elem.text.strip()
                    break

            # Extract brand
            brand = None
            brand_match = re.search(r'[Mm]arca[:\s]*(\w+)', content)
            if brand_match:
                brand = brand_match.group(1)

            # Extract category from breadcrumbs or URL
            categories = []
            breadcrumbs = soup.select('.breadcrumb a, nav a')
            for bc in breadcrumbs:
                text = bc.text.strip()
                if text and text.lower() not in ['inicio', 'home', 'sina']:
                    categories.append(text)

            # Generate slug
            slug = f"prod-sina-{sku}" if sku else f"prod-sina-{product_id}"

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
                categories=categories[:2] if categories else [],
                source_url=page.url,
            )

        except Exception as e:
            logger.error(f"[Sina] Error parseando página: {e}")
            return None

    async def close(self):
        """Close browser and cleanup."""
        if self._browser:
            await self._browser.close()
            self._browser = None
        if self._playwright:
            await self._playwright.stop()
            self._playwright = None
        self._page = None
        self._logged_in = False
        await super().close()


# Register the scraper
from app.scrapers.registry import ScraperRegistry
ScraperRegistry.register(SinaScraper)
