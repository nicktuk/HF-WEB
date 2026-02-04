"""
Scraper for protrade.com.ar

Este scraper está diseñado para el catálogo de Protrade.
Estructura idéntica a redlenic.uno.
Todos los productos están en una sola página (catalogo2024.php).
"""
from typing import Optional, Dict, List, Callable, Any
import re
import logging
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedProduct
from app.core.exceptions import ScraperError

logger = logging.getLogger(__name__)


class ProtradeScraper(BaseScraper):
    """Scraper for protrade.com.ar catalog.

    Estructura idéntica a Redlenic:
    - Productos en div.contenedor_producto
    - Nombre en h1
    - Precio en p.datos
    - Código en p.datos1
    - Categoría en p.rubro_centrado
    - Imágenes en .carousel-inner .item img
    """

    BASE_URL = "https://www.protrade.com.ar"
    CATALOG_URL = f"{BASE_URL}/catalogo2024.php?rub=99999"  # rub=99999 = TODAS las categorías

    @property
    def source_name(self) -> str:
        return "protrade"

    @property
    def rate_limit_delay(self) -> float:
        return 1.0

    async def _authenticate(self, config: Optional[Dict] = None) -> None:
        """
        Authenticate with the site if password is provided in config.
        """
        client = await self.get_client()

        # Get password from config if provided
        password = config.get("password") if config else None

        if not password:
            # No auth needed, just access the page directly
            return

        # First, get the login page
        try:
            response = await client.get(self.BASE_URL, headers=self.default_headers)
            response.raise_for_status()
        except Exception as e:
            raise ScraperError(
                f"Failed to access site: {str(e)}",
                source=self.source_name
            )

        # Submit the password form (same structure as redlenic)
        login_data = {
            "clave": password
        }

        try:
            response = await client.post(
                self.BASE_URL,
                data=login_data,
                headers=self.default_headers,
                follow_redirects=True
            )
            response.raise_for_status()
        except Exception as e:
            raise ScraperError(
                f"Failed to authenticate: {str(e)}",
                source=self.source_name
            )

    async def fetch_catalog(self, config: Optional[Dict] = None) -> BeautifulSoup:
        """
        Fetch catalog page, authenticating if needed.
        """
        await self._authenticate(config)
        return await self.fetch_html(self.CATALOG_URL)

    async def scrape_catalog(self, config: Optional[Dict] = None) -> List[str]:
        """
        Scrape all product identifiers from the catalog.
        Since all products are on one page, we return indices as identifiers.

        Returns:
            List of product indices as strings
        """
        products = await self.scrape_all_products(config)
        return [str(i) for i in range(len(products))]

    async def scrape_all_products(
        self,
        config: Optional[Dict] = None,
        on_product: Optional[Callable[[ScrapedProduct, int, int], Any]] = None,
        on_progress: Optional[Callable[[int, int], None]] = None
    ) -> List[ScrapedProduct]:
        """
        Scrape all products from the catalog page.

        Args:
            config: Optional scraper configuration
            on_product: Callback called for each product (product, index, total)
            on_progress: Callback for progress updates (current, total)

        Returns:
            List of ScrapedProduct objects
        """
        logger.info(f"Conectando a {self.CATALOG_URL}...")
        print(f"[Protrade] Conectando a {self.CATALOG_URL}...")

        soup = await self.fetch_catalog(config)

        products = []
        product_containers = soup.select("div.contenedor_producto")

        if not product_containers:
            # Check if we got an error message
            body_text = soup.get_text().lower()
            if "clave" in body_text or "acceso" in body_text:
                raise ScraperError(
                    "Access denied. Site requires password. Add 'password' to scraper_config.",
                    source=self.source_name
                )
            raise ScraperError(
                "No products found on catalog page.",
                source=self.source_name
            )

        total = len(product_containers)
        logger.info(f"Encontrados {total} productos en el catálogo")
        print(f"[Protrade] Encontrados {total} productos en el catálogo")

        for idx, container in enumerate(product_containers):
            try:
                product = self._parse_product(container, idx)
                if product:
                    products.append(product)

                    if on_product:
                        on_product(product, idx, total)

                    if (idx + 1) % 10 == 0 or idx == total - 1:
                        progress_msg = f"[Protrade] Procesados {idx + 1}/{total} productos..."
                        logger.info(progress_msg)
                        print(progress_msg)

                        if on_progress:
                            on_progress(idx + 1, total)

            except Exception as e:
                logger.warning(f"Error procesando producto {idx}: {e}")
                continue

        logger.info(f"Scraping completado: {len(products)} productos extraídos")
        print(f"[Protrade] Completado: {len(products)} productos extraídos")

        return products

    async def scrape_product(
        self,
        identifier: str,
        config: Optional[Dict] = None
    ) -> ScrapedProduct:
        """
        Scrape a single product by its index.
        """
        try:
            idx = int(identifier)
        except ValueError:
            raise ScraperError(
                f"Invalid product identifier: {identifier}. Expected numeric index.",
                source=self.source_name
            )

        products = await self.scrape_all_products(config)

        if idx < 0 or idx >= len(products):
            raise ScraperError(
                f"Product index {idx} out of range. Found {len(products)} products.",
                source=self.source_name
            )

        return products[idx]

    def _parse_product(self, container: BeautifulSoup, idx: int) -> Optional[ScrapedProduct]:
        """Parse a single product from its container div."""
        # Extract name from h1
        name_elem = container.select_one("h1")
        name = name_elem.text.strip() if name_elem else None

        if not name:
            return None

        # Clean up name
        name = self._clean_name(name)

        # Extract SKU/code
        sku = self._extract_sku_from_container(container)

        # Generate slug
        slug = self._generate_slug(name, idx, sku)

        # Extract price
        price = self._extract_price_from_container(container)

        # Extract images
        images = self._extract_images_from_container(container)

        # Extract category
        category = self._extract_category_from_container(container)

        # Extract brand from name
        brand = self._extract_brand(name)

        return ScrapedProduct(
            slug=slug,
            name=name,
            price=price,
            currency="ARS",
            description=None,
            short_description=None,
            brand=brand,
            sku=sku,
            images=images,
            categories=[category] if category else [],
            source_url=self.CATALOG_URL,
        )

    def _clean_name(self, name: str) -> str:
        """Clean product name."""
        name = re.sub(r'[\s\-]+$', '', name)
        name = re.sub(r'\s*-\s*-[\s\-]*', '', name)
        name = re.sub(r'\s+', ' ', name)
        return name.strip()

    def _generate_slug(self, name: str, idx: int, sku: Optional[str] = None) -> str:
        """Generate URL-friendly slug."""
        if sku:
            return f"prod-pt-{sku}"

        slug = re.sub(r'[^\w\s-]', '', name.lower())
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        slug = slug.strip('-')
        return f"{slug}-{idx}" if slug else f"producto-pt-{idx}"

    def _extract_price_from_container(self, container: BeautifulSoup) -> Optional[float]:
        """Extract price from p.datos element."""
        price_elem = container.select_one("p.datos")
        if not price_elem:
            return None

        price_text = price_elem.text.strip()
        return self.extract_price(price_text)

    def _extract_category_from_container(self, container: BeautifulSoup) -> Optional[str]:
        """Extract category from p.rubro_centrado element."""
        cat_elem = container.select_one("p.rubro_centrado")
        if not cat_elem:
            return None

        category = cat_elem.text.strip()
        try:
            category = category.encode('latin-1').decode('utf-8')
        except (UnicodeDecodeError, UnicodeEncodeError):
            pass

        return category if category else None

    def _extract_sku_from_container(self, container: BeautifulSoup) -> Optional[str]:
        """Extract product code from p.datos1 element."""
        datos_elems = container.select("p.datos1")
        for elem in datos_elems:
            text = elem.text.strip()
            if "Cód.:" in text or "Cod.:" in text:
                match = re.search(r'C[oó]d\.?:\s*(\d+)', text, re.IGNORECASE)
                if match:
                    return match.group(1)
        return None

    def _extract_images_from_container(self, container: BeautifulSoup) -> List[str]:
        """Extract product images from container."""
        images = []

        img_elems = container.select(".carousel-inner .item img")

        if not img_elems:
            img_elems = container.select("img")

        for img in img_elems:
            src = img.get("src") or img.get("data-src")
            if src and self._is_valid_image(src):
                full_url = self.normalize_image_url(src, self.BASE_URL)
                if full_url not in images:
                    images.append(full_url)

        return images[:5]

    def _is_valid_image(self, url: str) -> bool:
        """Check if URL is a valid product image."""
        if not url:
            return False

        skip_patterns = [
            'logo', 'icon', 'banner', 'ad-',
            'widget', 'avatar', 'placeholder',
            'button', 'btn', 'cart', 'carrito'
        ]

        url_lower = url.lower()
        return not any(pattern in url_lower for pattern in skip_patterns)

    def _extract_brand(self, name: str) -> Optional[str]:
        """Extract brand from product name."""
        known_brands = [
            "BGH", "Samsung", "LG", "Philips", "Philco", "Atma",
            "Whirlpool", "Electrolux", "Drean", "Gafa", "Patrick",
            "Peabody", "Oster", "Liliana", "Midea", "TCL", "Noblex",
            "Ranser", "Sanyo", "JBL", "Sony", "Xiaomi", "Motorola",
            "Star Trak", "Lenovo", "HP", "Dell", "Apple", "Huawei",
            "Kodak", "RCA", "Candy", "Longvie", "Siam", "Aurora"
        ]

        name_upper = name.upper()
        for brand in known_brands:
            if brand.upper() in name_upper:
                return brand

        return None


# Register the scraper
from app.scrapers.registry import ScraperRegistry
ScraperRegistry.register(ProtradeScraper)
