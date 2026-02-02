"""
Scraper for decomoda-mayorista.com.ar

Este scraper está diseñado para el catálogo de DecoModa Mayorista.
No requiere autenticación.
Los productos se listan en la página de categoría "TODOS NUESTROS PRODUCTOS"
y los detalles se obtienen de las páginas individuales (/store/ID).

NOTA: La página de categoría usa JavaScript para renderizar productos,
por lo que usamos Playwright para obtener el HTML completo.
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

# Playwright is optional - only used for catalog scraping
try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False
    logger.warning("Playwright not installed. DecoModa scraper will use sitemap fallback.")


class DecoModaScraper(BaseScraper):
    """Scraper for decomoda-mayorista.com.ar catalog.

    Usa Playwright para renderizar JavaScript y obtener todos los productos
    de la página de categoría "TODOS NUESTROS PRODUCTOS".
    Fallback a sitemap.xml si Playwright no está disponible.
    """

    BASE_URL = "https://decomoda-mayorista.com.ar"
    ALL_PRODUCTS_URL = f"{BASE_URL}/categoria/66137823529174453"
    SITEMAP_URL = f"{BASE_URL}/sitemap.xml"

    @property
    def source_name(self) -> str:
        return "decomoda"

    @property
    def rate_limit_delay(self) -> float:
        return 0.5  # 500ms between requests

    async def scrape_catalog(self, config: Optional[Dict] = None) -> List[str]:
        """
        Scrape all product identifiers from the catalog.

        Returns:
            List of product IDs (from /store/ID URLs)
        """
        products = await self._get_product_ids()
        return products

    async def _get_product_ids(self) -> List[str]:
        """
        Get all product IDs from the catalog.

        Uses Playwright to render JavaScript if available, otherwise falls back to sitemap.

        Returns:
            List of product IDs
        """
        if PLAYWRIGHT_AVAILABLE:
            print(f"[DecoModa] Playwright disponible, intentando renderizar JS...")
            try:
                return await self._get_product_ids_playwright()
            except Exception as e:
                print(f"[DecoModa] Error con Playwright: {e}")
                print(f"[DecoModa] Usando sitemap como fallback...")
                return await self._get_product_ids_sitemap()
        else:
            print(f"[DecoModa] Playwright NO disponible, usando sitemap...")
            return await self._get_product_ids_sitemap()

    async def _get_product_ids_playwright(self) -> List[str]:
        """
        Get product IDs using Playwright to render JavaScript.

        Returns:
            List of product IDs
        """
        logger.info(f"Usando Playwright para {self.ALL_PRODUCTS_URL}")
        print(f"[DecoModa] Usando Playwright para renderizar JavaScript...")

        product_ids = set()

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page()

                # Navigate and wait for products to load
                await page.goto(self.ALL_PRODUCTS_URL, wait_until='networkidle')

                # Wait a bit more for dynamic content
                await asyncio.sleep(2)

                # Get all links
                content = await page.content()
                await browser.close()

                # Parse HTML and extract product IDs
                for match in re.finditer(r'/store/(\d+)', content):
                    product_ids.add(match.group(1))

                logger.info(f"Playwright encontró {len(product_ids)} productos")
                print(f"[DecoModa] Encontrados {len(product_ids)} productos con Playwright")

        except Exception as e:
            logger.error(f"Error con Playwright: {e}")
            print(f"[DecoModa] Error con Playwright: {e}, usando sitemap como fallback...")
            return await self._get_product_ids_sitemap()

        return list(product_ids)

    async def _get_product_ids_sitemap(self) -> List[str]:
        """
        Fallback: Get product IDs from sitemap (many will be 404).

        Returns:
            List of product IDs
        """
        logger.info(f"Usando sitemap fallback: {self.SITEMAP_URL}")
        print(f"[DecoModa] Usando sitemap (algunos productos pueden ser 404)...")

        client = await self.get_client()

        try:
            response = await client.get(self.SITEMAP_URL, headers=self.default_headers)
            response.raise_for_status()
            content = response.text
        except Exception as e:
            logger.error(f"Error fetching sitemap: {e}")
            raise ScraperError(f"Could not fetch sitemap: {e}", source=self.source_name)

        product_ids = set()

        for match in re.finditer(r'/store/(\d+)', content):
            product_ids.add(match.group(1))

        logger.info(f"Sitemap tiene {len(product_ids)} URLs (algunas pueden ser 404)")
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
            config: Optional scraper configuration
            on_product: Callback called for each product (product, index, total)
            on_progress: Callback for progress updates (current, total)

        Returns:
            List of ScrapedProduct objects
        """
        logger.info(f"Iniciando scraping de {self.BASE_URL}...")
        print(f"[DecoModa] Iniciando scraping...")

        product_ids = await self._get_product_ids()

        if not product_ids:
            raise ScraperError(
                "No products found on catalog page.",
                source=self.source_name
            )

        total = len(product_ids)
        logger.info(f"Encontrados {total} productos en el catálogo")
        print(f"[DecoModa] Encontrados {total} productos en el catálogo")

        products = []

        for idx, product_id in enumerate(product_ids):
            try:
                product = await self._scrape_product_detail(product_id)
                if product:
                    products.append(product)

                    # Call product callback if provided
                    if on_product:
                        on_product(product, idx, total)

                # Show progress every 10 products or at the end
                if (idx + 1) % 10 == 0 or idx == total - 1:
                    progress_msg = f"[DecoModa] Procesados {idx + 1}/{total} productos..."
                    logger.info(progress_msg)
                    print(progress_msg)

                    if on_progress:
                        on_progress(idx + 1, total)

                # Rate limiting
                await asyncio.sleep(self.rate_limit_delay)

            except Exception as e:
                logger.warning(f"Error procesando producto {product_id}: {e}")
                continue

        logger.info(f"Scraping completado: {len(products)} productos extraídos")
        print(f"[DecoModa] Completado: {len(products)} productos extraídos")

        return products

    async def scrape_product(
        self,
        identifier: str,
        config: Optional[Dict] = None
    ) -> ScrapedProduct:
        """
        Scrape a single product by its ID.

        Args:
            identifier: Product ID
            config: Optional scraper configuration

        Returns:
            ScrapedProduct with extracted data
        """
        product = await self._scrape_product_detail(identifier)
        if not product:
            raise ScraperError(
                f"Failed to scrape product {identifier}",
                source=self.source_name
            )
        return product

    async def _scrape_product_detail(self, product_id: str) -> Optional[ScrapedProduct]:
        """
        Scrape product details from its individual page.

        Args:
            product_id: Product ID

        Returns:
            ScrapedProduct or None if parsing fails
        """
        url = f"{self.BASE_URL}/store/{product_id}"

        try:
            soup = await self.fetch_html(url)
        except Exception as e:
            logger.warning(f"Error fetching product {product_id}: {e}")
            return None

        # Try to extract from JSON-LD schema first (most reliable)
        product_data = self._extract_from_schema(soup)

        if product_data and product_data.get('name'):
            name = product_data.get('name')
            price = product_data.get('price')
            sku = product_data.get('sku')
            description = product_data.get('description')
            images = product_data.get('images', [])
            logger.debug(f"Product {product_id}: schema OK, {len(images)} images")
        else:
            # Fallback to HTML parsing
            logger.debug(f"Product {product_id}: using HTML fallback")
            name = self._extract_name(soup)
            price = self._extract_price(soup)
            sku = self._extract_sku(soup)
            description = self._extract_description(soup)
            images = self._extract_images(soup)

        if not name:
            logger.warning(f"Product {product_id}: no name found, skipping")
            return None

        # If no images from schema, try fallback
        if not images:
            images = self._extract_images(soup)
            logger.debug(f"Product {product_id}: fallback images: {len(images)}")

        # Generate neutral slug (no source name!)
        slug = f"prod-{sku}" if sku else f"prod-dm-{product_id}"

        return ScrapedProduct(
            slug=slug,
            name=name,
            price=price,
            currency="ARS",
            description=description,
            short_description=description[:200] if description and len(description) > 200 else description,
            brand="DECOMODA",
            sku=sku,
            images=images[:5],  # Limit to 5 images
            categories=[],
            source_url=url,
        )

    def _extract_from_schema(self, soup: BeautifulSoup) -> Optional[Dict]:
        """Extract product data from JSON-LD schema."""
        schema_scripts = soup.select('script[type="application/ld+json"]')

        for script in schema_scripts:
            try:
                # Try multiple ways to get script content
                script_content = script.string or script.get_text() or ''
                if not script_content.strip():
                    continue

                data = json.loads(script_content)

                # Handle both direct Product and @graph structures
                if data.get('@type') == 'Product':
                    result = self._parse_schema_product(data)
                    logger.debug(f"Found Product schema: {result.get('name')}, images: {len(result.get('images', []))}")
                    return result

                if '@graph' in data:
                    for item in data['@graph']:
                        if item.get('@type') == 'Product':
                            result = self._parse_schema_product(item)
                            logger.debug(f"Found Product in @graph: {result.get('name')}")
                            return result

            except (json.JSONDecodeError, TypeError) as e:
                logger.debug(f"Error parsing JSON-LD: {e}")
                continue

        logger.debug("No Product schema found")
        return None

    def _parse_schema_product(self, data: Dict) -> Dict:
        """Parse product data from schema.org Product structure."""
        result = {
            'name': data.get('name'),
            'description': data.get('description'),
            'sku': data.get('sku'),
            'images': []
        }

        # Extract price from offers
        offers = data.get('offers', {})
        if isinstance(offers, list) and offers:
            offers = offers[0]

        price_str = offers.get('price')
        if price_str:
            try:
                result['price'] = float(price_str)
            except (ValueError, TypeError):
                result['price'] = None

        # Extract images (exclude logo)
        image = data.get('image')
        logger.debug(f"Schema image field: {image}")
        if image:
            images = []
            if isinstance(image, str):
                images = [image]
            elif isinstance(image, list):
                images = [img if isinstance(img, str) else img.get('url', '') for img in image]

            # Filter out logo images
            result['images'] = [
                img for img in images
                if img and 'logo' not in img.lower()
            ]
            logger.debug(f"Filtered images: {result['images']}")

        return result

    def _extract_name(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract product name from HTML."""
        # Try h1 first
        h1 = soup.select_one('h1')
        if h1:
            return h1.text.strip()

        # Try meta og:title
        og_title = soup.select_one('meta[property="og:title"]')
        if og_title:
            return og_title.get('content', '').strip()

        return None

    def _extract_price(self, soup: BeautifulSoup) -> Optional[float]:
        """Extract price from HTML."""
        # Try various price patterns
        price_patterns = [
            r'\$\s*([\d.,]+)',
            r'precio[:\s]*([\d.,]+)',
            r'([\d.,]+)\s*ARS'
        ]

        # Look in common price containers
        text = soup.get_text()

        for pattern in price_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return self.extract_price(match.group(1))

        return None

    def _extract_sku(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract SKU/code from HTML."""
        # Look for "Código: XXXX" pattern
        text = soup.get_text()
        match = re.search(r'[Cc][oó]digo[:\s]*(\d+)', text)
        if match:
            return match.group(1)
        return None

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract description from HTML."""
        # Site-wide description to ignore
        site_description = "DISTRIBUIDORA MAYORISTA DECOMODA"

        # Try meta description
        meta_desc = soup.select_one('meta[name="description"]')
        if meta_desc:
            content = meta_desc.get('content', '').strip()
            # Skip if it's the generic site description
            if content and site_description not in content:
                return content

        # Try og:description
        og_desc = soup.select_one('meta[property="og:description"]')
        if og_desc:
            content = og_desc.get('content', '').strip()
            if content and site_description not in content:
                return content

        return None

    def _extract_images(self, soup: BeautifulSoup) -> List[str]:
        """Extract product images from HTML."""
        images = []

        # Try og:image first (most reliable for product image)
        og_image = soup.select_one('meta[property="og:image"]')
        if og_image:
            content = og_image.get('content', '')
            if content and 'logo' not in content.lower():
                images.append(content)

        # Look for images from bunny CDN (the product image CDN)
        for img in soup.select('img[src*="bunny-cdn"]'):
            src = img.get('src', '')
            # Filter out logos and common non-product images
            if src and src not in images and 'logo' not in src.lower():
                images.append(src)

        return images


# Register the scraper
from app.scrapers.registry import ScraperRegistry
ScraperRegistry.register(DecoModaScraper)
