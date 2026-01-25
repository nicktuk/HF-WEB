"""
Scraper for newredmayorista.com.ar

Este scraper está diseñado para el catálogo mayorista de New Red.
Nota: Los precios no están visibles públicamente en este sitio,
      el admin deberá ingresarlos manualmente.
"""
from typing import Optional, Dict, List
import re
import asyncio
from bs4 import BeautifulSoup

from app.scrapers.base import BaseScraper, ScrapedProduct
from app.core.exceptions import ScraperError


class NewRedMayoristaScraper(BaseScraper):
    """Scraper for newredmayorista.com.ar catalog."""

    BASE_URL = "https://newredmayorista.com.ar"

    @property
    def source_name(self) -> str:
        return "newredmayorista"

    @property
    def rate_limit_delay(self) -> float:
        return 2.0  # Be respectful with requests

    async def scrape_catalog(self, config: Optional[Dict] = None) -> List[str]:
        """
        Scrape all product slugs from the catalog.

        Returns:
            List of product slugs found in the catalog
        """
        all_slugs = []
        page = 1
        max_pages = 100  # Safety limit

        while page <= max_pages:
            # Try different pagination URL patterns
            if page == 1:
                url = f"{self.BASE_URL}/tienda/"
            else:
                url = f"{self.BASE_URL}/tienda/page/{page}/"

            try:
                soup = await self.fetch_html(url)

                # Find product links
                product_links = soup.select(
                    "a.woocommerce-LoopProduct-link, "
                    ".product a[href*='/producto/'], "
                    ".products a[href*='/producto/']"
                )

                if not product_links:
                    # Also try these selectors
                    product_links = soup.select(
                        "li.product a[href*='/producto/'], "
                        ".product-item a[href*='/producto/']"
                    )

                if not product_links:
                    break  # No more products

                page_slugs = []
                for link in product_links:
                    href = link.get('href', '')
                    if '/producto/' in href:
                        # Extract slug from URL
                        slug = href.split('/producto/')[-1].strip('/')
                        if slug and slug not in all_slugs and slug not in page_slugs:
                            page_slugs.append(slug)

                if not page_slugs:
                    break  # No new products found

                all_slugs.extend(page_slugs)
                page += 1

                # Respect rate limit
                await asyncio.sleep(self.rate_limit_delay)

            except Exception:
                # If page doesn't exist or error, stop pagination
                break

        return all_slugs

    async def scrape_product(
        self,
        identifier: str,
        config: Optional[Dict] = None
    ) -> ScrapedProduct:
        """
        Scrape product from newredmayorista.com.ar

        Args:
            identifier: Product slug (e.g., "heladera-bgh-inox-404l")
            config: Optional scraper configuration

        Returns:
            ScrapedProduct with extracted data
        """
        # Build URL
        slug = identifier.lower().strip("/")
        url = f"{self.BASE_URL}/producto/{slug}/"

        # Fetch and parse
        soup = await self.fetch_html(url)

        # Extract product name
        name = self._extract_name(soup)
        if not name:
            raise ScraperError(
                f"Could not extract product name from {url}",
                source=self.source_name
            )

        # Extract other data
        description = self._extract_description(soup)
        short_description = self._extract_short_description(soup)
        images = self._extract_images(soup)
        categories = self._extract_categories(soup)
        brand = self._extract_brand(soup, name)
        sku = self._extract_sku(soup, description)

        # Note: This site doesn't show prices publicly
        # Price will be None and admin must set it manually
        price = self._extract_price(soup)

        return ScrapedProduct(
            slug=slug,
            name=name,
            price=price,
            description=description,
            short_description=short_description,
            brand=brand,
            sku=sku,
            images=images,
            categories=categories,
            source_url=url,
        )

    def _extract_name(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract product name."""
        selectors = [
            "h1.product_title",
            ".product-title h1",
            "h1.entry-title",
            ".elementor-heading-title",
        ]

        for selector in selectors:
            name = self.extract_text(soup, selector)
            if name:
                return name.strip()

        return None

    def _extract_price(self, soup: BeautifulSoup) -> Optional[float]:
        """
        Try to extract price.
        Note: This site typically doesn't show prices publicly.
        """
        selectors = [
            ".price .woocommerce-Price-amount",
            ".price .amount",
            "span.price",
            ".product-price",
        ]

        for selector in selectors:
            price_text = self.extract_text(soup, selector)
            if price_text:
                price = self.extract_price(price_text)
                if price and price > 0:
                    return price

        return None

    def _extract_description(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract full product description."""
        selectors = [
            ".woocommerce-product-details__short-description",
            ".product-description",
            "#tab-description",
            ".elementor-widget-theme-post-content",
        ]

        for selector in selectors:
            desc = self.extract_text(soup, selector)
            if desc:
                desc = re.sub(r'\s+', ' ', desc).strip()
                if len(desc) > 50:
                    return desc

        return None

    def _extract_short_description(self, soup: BeautifulSoup) -> Optional[str]:
        """Extract short description (first paragraph or truncated)."""
        description = self._extract_description(soup)
        if description:
            sentences = description.split('.')
            if sentences:
                short = sentences[0].strip()
                if len(short) > 20:
                    return short + '.'

            if len(description) > 200:
                return description[:197] + '...'
            return description

        return None

    def _extract_images(self, soup: BeautifulSoup) -> List[str]:
        """Extract product images."""
        images = []

        gallery_selectors = [
            ".woocommerce-product-gallery img",
            ".product-gallery img",
            ".product-images img",
            ".elementor-widget-theme-post-featured-image img",
        ]

        for selector in gallery_selectors:
            img_urls = self.extract_all_attrs(soup, selector, "src")
            for url in img_urls:
                if url and self._is_valid_image(url):
                    full_url = self.normalize_image_url(url, self.BASE_URL)
                    if full_url not in images:
                        images.append(full_url)

            lazy_urls = self.extract_all_attrs(soup, selector, "data-src")
            for url in lazy_urls:
                if url and self._is_valid_image(url):
                    full_url = self.normalize_image_url(url, self.BASE_URL)
                    if full_url not in images:
                        images.append(full_url)

            if images:
                break

        images = [
            img for img in images
            if not any(x in img.lower() for x in ['placeholder', 'woocommerce-placeholder', '150x150', '100x100'])
        ]

        return images[:10]

    def _is_valid_image(self, url: str) -> bool:
        """Check if URL is a valid product image."""
        if not url:
            return False

        skip_patterns = [
            'logo', 'icon', 'banner', 'ad-',
            'widget', 'avatar', 'placeholder'
        ]

        url_lower = url.lower()
        return not any(pattern in url_lower for pattern in skip_patterns)

    def _extract_categories(self, soup: BeautifulSoup) -> List[str]:
        """Extract product categories from breadcrumbs."""
        categories = []

        breadcrumb_selectors = [
            ".breadcrumb a",
            ".woocommerce-breadcrumb a",
            "nav.breadcrumb a",
        ]

        for selector in breadcrumb_selectors:
            texts = self.extract_all_text(soup, selector)
            if texts:
                categories = [
                    t for t in texts
                    if t.lower() not in ['inicio', 'home', '']
                ]
                break

        if not categories:
            cat_link = soup.select_one("a[href*='/categoria/']")
            if cat_link:
                categories = [cat_link.text.strip()]

        return categories

    def _extract_brand(self, soup: BeautifulSoup, name: str) -> Optional[str]:
        """Extract brand from page or infer from name."""
        brand_selectors = [
            ".product-brand",
            ".brand",
            "span[itemprop='brand']",
        ]

        for selector in brand_selectors:
            brand = self.extract_text(soup, selector)
            if brand:
                return brand

        known_brands = [
            "BGH", "Samsung", "LG", "Philips", "Philco", "Atma",
            "Whirlpool", "Electrolux", "Drean", "Gafa", "Patrick",
            "Peabody", "Oster", "Liliana", "Midea", "TCL", "Noblex",
            "Ranser", "Sanyo", "JBL", "Sony", "Xiaomi", "Motorola",
            "Star Trak", "Lenovo", "HP", "Dell"
        ]

        name_upper = name.upper()
        for brand in known_brands:
            if brand.upper() in name_upper:
                return brand

        return None

    def _extract_sku(self, soup: BeautifulSoup, description: Optional[str]) -> Optional[str]:
        """Extract SKU or model number."""
        sku_selectors = [
            ".sku",
            "span[itemprop='sku']",
            ".product-sku",
        ]

        for selector in sku_selectors:
            sku = self.extract_text(soup, selector)
            if sku:
                return sku

        if description:
            model_pattern = r'\b([A-Z]{2,}[\d]{2,}[A-Z\d]*)\b'
            match = re.search(model_pattern, description)
            if match:
                return match.group(1)

        return None


# Register the scraper
from app.scrapers.registry import ScraperRegistry
ScraperRegistry.register(NewRedMayoristaScraper)
