"""
Scraper for decomoda-mayorista.com.ar

Este scraper está diseñado para el catálogo de DecoModa Mayorista.
No requiere autenticación.
Los productos se listan en la página principal y los detalles se obtienen
de las páginas individuales (/store/ID).
"""
from typing import Optional, Dict, List, Callable, Any
import re
import json
import logging
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedProduct
from app.core.exceptions import ScraperError

logger = logging.getLogger(__name__)


class DecoModaScraper(BaseScraper):
    """Scraper for decomoda-mayorista.com.ar catalog."""

    BASE_URL = "https://decomoda-mayorista.com.ar"
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
        Get all product IDs from the sitemap.

        Returns:
            List of product IDs
        """
        client = await self.get_client()

        try:
            response = await client.get(self.SITEMAP_URL, headers=self.default_headers)
            response.raise_for_status()
            content = response.text
        except Exception as e:
            logger.error(f"Error fetching sitemap: {e}")
            raise ScraperError(f"Could not fetch sitemap: {e}", source=self.source_name)

        # Parse sitemap XML and extract /store/ID URLs
        product_ids = set()

        for match in re.finditer(r'/store/(\d+)', content):
            product_ids.add(match.group(1))

        logger.info(f"Found {len(product_ids)} product IDs in sitemap")
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
        logger.info(f"Conectando a {self.SITEMAP_URL}...")
        print(f"[DecoModa] Conectando a {self.SITEMAP_URL}...")

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
                await self._rate_limit()

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

        if product_data:
            name = product_data.get('name')
            price = product_data.get('price')
            sku = product_data.get('sku')
            description = product_data.get('description')
            images = product_data.get('images', [])
        else:
            # Fallback to HTML parsing
            name = self._extract_name(soup)
            price = self._extract_price(soup)
            sku = self._extract_sku(soup)
            description = self._extract_description(soup)
            images = self._extract_images(soup)

        if not name:
            return None

        # Generate slug using SKU or product_id
        slug = f"decomoda-{sku}" if sku else f"decomoda-{product_id}"

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
                data = json.loads(script.string)

                # Handle both direct Product and @graph structures
                if data.get('@type') == 'Product':
                    return self._parse_schema_product(data)

                if '@graph' in data:
                    for item in data['@graph']:
                        if item.get('@type') == 'Product':
                            return self._parse_schema_product(item)

            except (json.JSONDecodeError, TypeError):
                continue

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

        # Extract images
        image = data.get('image')
        if image:
            if isinstance(image, str):
                result['images'] = [image]
            elif isinstance(image, list):
                result['images'] = [img if isinstance(img, str) else img.get('url', '') for img in image]

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
        # Try meta description
        meta_desc = soup.select_one('meta[name="description"]')
        if meta_desc:
            return meta_desc.get('content', '').strip()

        # Try og:description
        og_desc = soup.select_one('meta[property="og:description"]')
        if og_desc:
            return og_desc.get('content', '').strip()

        return None

    def _extract_images(self, soup: BeautifulSoup) -> List[str]:
        """Extract product images from HTML."""
        images = []

        # Look for images from bunny CDN (the product image CDN)
        for img in soup.select('img[src*="bunny-cdn"]'):
            src = img.get('src')
            if src and src not in images:
                images.append(src)

        # Also try og:image
        og_image = soup.select_one('meta[property="og:image"]')
        if og_image:
            content = og_image.get('content')
            if content and content not in images:
                images.insert(0, content)

        return images


# Register the scraper
from app.scrapers.registry import ScraperRegistry
ScraperRegistry.register(DecoModaScraper)
