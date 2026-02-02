"""
Scraper for redlenic.uno

Este scraper está diseñado para el catálogo de Redlenic.
Requiere autenticación con password para acceder al catálogo.
Todos los productos están en una sola página (catalogo2024.php).
"""
from typing import Optional, Dict, List, Callable, Any
import re
import logging
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedProduct
from app.core.exceptions import ScraperError

logger = logging.getLogger(__name__)


class RedlenicScraper(BaseScraper):
    """Scraper for redlenic.uno catalog."""

    BASE_URL = "https://www.redlenic.uno"
    CATALOG_URL = f"{BASE_URL}/catalogo2024.php"
    LOGIN_URL = BASE_URL  # Login form is on the main page
    PASSWORD = "catan"

    @property
    def source_name(self) -> str:
        return "redlenic"

    @property
    def rate_limit_delay(self) -> float:
        return 1.0

    async def _authenticate(self) -> None:
        """
        Authenticate with the site using the password.
        The site uses a simple password-only form.
        """
        client = await self.get_client()

        # First, get the login page to find the form structure
        try:
            response = await client.get(self.LOGIN_URL, headers=self.default_headers)
            response.raise_for_status()
        except Exception as e:
            raise ScraperError(
                f"Failed to access login page: {str(e)}",
                source=self.source_name
            )

        # Submit the password form
        # Based on the JS: document.form1.clave.focus() - form name is "form1", field is "clave"
        login_data = {
            "clave": self.PASSWORD
        }

        try:
            response = await client.post(
                self.LOGIN_URL,
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

    async def fetch_authenticated(self, url: str) -> BeautifulSoup:
        """
        Fetch a URL with authentication.
        """
        await self._authenticate()
        return await self.fetch_html(url)

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
        This is the main method since all products are on a single page.

        Args:
            config: Optional scraper configuration
            on_product: Callback called for each product (product, index, total)
            on_progress: Callback for progress updates (current, total)

        Returns:
            List of ScrapedProduct objects
        """
        logger.info(f"Conectando a {self.CATALOG_URL}...")
        print(f"[Redlenic] Conectando a {self.CATALOG_URL}...")

        soup = await self.fetch_authenticated(self.CATALOG_URL)

        products = []
        product_containers = soup.select("div.contenedor_producto")

        if not product_containers:
            raise ScraperError(
                "No products found on catalog page. Check if authentication worked.",
                source=self.source_name
            )

        total = len(product_containers)
        logger.info(f"Encontrados {total} productos en el catálogo")
        print(f"[Redlenic] Encontrados {total} productos en el catálogo")

        for idx, container in enumerate(product_containers):
            try:
                product = self._parse_product(container, idx)
                if product:
                    products.append(product)

                    # Call product callback if provided
                    if on_product:
                        on_product(product, idx, total)

                    # Show progress every 10 products or at the end
                    if (idx + 1) % 10 == 0 or idx == total - 1:
                        progress_msg = f"[Redlenic] Procesados {idx + 1}/{total} productos..."
                        logger.info(progress_msg)
                        print(progress_msg)

                        if on_progress:
                            on_progress(idx + 1, total)

            except Exception as e:
                logger.warning(f"Error procesando producto {idx}: {e}")
                continue

        logger.info(f"Scraping completado: {len(products)} productos extraídos")
        print(f"[Redlenic] Completado: {len(products)} productos extraídos")

        return products

    async def scrape_product(
        self,
        identifier: str,
        config: Optional[Dict] = None
    ) -> ScrapedProduct:
        """
        Scrape a single product by its index.
        Since all products are on one page, we fetch all and return the one at index.

        Args:
            identifier: Product index as string
            config: Optional scraper configuration

        Returns:
            ScrapedProduct with extracted data
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
        """
        Parse a single product from its container div.

        Args:
            container: BeautifulSoup element for div.contenedor_producto
            idx: Product index for generating slug

        Returns:
            ScrapedProduct or None if parsing fails
        """
        # Extract name from h1
        name_elem = container.select_one("h1")
        name = name_elem.text.strip() if name_elem else None

        if not name:
            return None

        # Clean up name (remove trailing dashes and extra spaces)
        name = self._clean_name(name)

        # Generate slug from name
        slug = self._generate_slug(name, idx)

        # Extract price from p.datos
        price = self._extract_price_from_container(container)

        # Extract image
        images = self._extract_images_from_container(container)

        # Try to extract brand from name
        brand = self._extract_brand(name)

        return ScrapedProduct(
            slug=slug,
            name=name,
            price=price,
            currency="ARS",
            description=None,
            short_description=None,
            brand=brand,
            sku=None,
            images=images,
            categories=[],
            source_url=self.CATALOG_URL,
        )

    def _clean_name(self, name: str) -> str:
        """Clean product name by removing trailing dashes and extra whitespace."""
        # Remove trailing dashes and spaces (patterns like "- - - - -")
        name = re.sub(r'[\s\-]+$', '', name)
        # Remove multiple consecutive dashes
        name = re.sub(r'\s*-\s*-[\s\-]*', '', name)
        # Clean up multiple spaces
        name = re.sub(r'\s+', ' ', name)
        return name.strip()

    def _generate_slug(self, name: str, idx: int) -> str:
        """Generate a URL-friendly slug from product name."""
        # Remove special characters and convert to lowercase
        slug = re.sub(r'[^\w\s-]', '', name.lower())
        # Replace spaces with hyphens
        slug = re.sub(r'[\s_]+', '-', slug)
        # Remove multiple consecutive hyphens
        slug = re.sub(r'-+', '-', slug)
        # Strip leading/trailing hyphens
        slug = slug.strip('-')
        # Add index to ensure uniqueness
        return f"{slug}-{idx}" if slug else f"producto-{idx}"

    def _extract_price_from_container(self, container: BeautifulSoup) -> Optional[float]:
        """Extract price from p.datos element."""
        price_elem = container.select_one("p.datos")
        if not price_elem:
            return None

        price_text = price_elem.text.strip()
        return self.extract_price(price_text)

    def _extract_images_from_container(self, container: BeautifulSoup) -> List[str]:
        """Extract product images from container."""
        images = []

        img_elems = container.select("img")
        for img in img_elems:
            src = img.get("src") or img.get("data-src")
            if src and self._is_valid_image(src):
                full_url = self.normalize_image_url(src, self.BASE_URL)
                if full_url not in images:
                    images.append(full_url)

        return images[:5]  # Limit to 5 images per product

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
ScraperRegistry.register(RedlenicScraper)
