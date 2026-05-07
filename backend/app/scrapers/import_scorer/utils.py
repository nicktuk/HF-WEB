"""Utilidades compartidas para scrapers de Import Scorer."""
import httpx
from app.config import settings

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
}


def get_client(timeout: int = 25, extra_headers: dict = None) -> httpx.AsyncClient:
    """Devuelve un AsyncClient con proxy opcional según configuración."""
    headers = {**BROWSER_HEADERS, **(extra_headers or {})}
    proxy = settings.SCRAPER_PROXY_URL or None
    return httpx.AsyncClient(
        headers=headers,
        timeout=timeout,
        follow_redirects=True,
        proxy=proxy,
    )
