"""
Configuración centralizada de la aplicación.
Usa pydantic-settings para validación y carga de variables de entorno.
"""
import json
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/catalog_db"
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10

    # Security
    ADMIN_API_KEY: str = "change_me_in_production"
    SECRET_KEY: str = "change_me_in_production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours

    # CORS - stored as string, parsed via property
    #ALLOWED_ORIGINS_STR: str = "http://localhost:3000"
    ALLOWED_ORIGINS_STR: str = "https://hf-web-production.up.railway.app"

    @property
    def ALLOWED_ORIGINS(self) -> List[str]:
        """Parse ALLOWED_ORIGINS from string (JSON array or comma-separated)."""
        v = self.ALLOWED_ORIGINS_STR
        # Try JSON first
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass
        # Fall back to comma-separated
        return [origin.strip() for origin in v.split(',') if origin.strip()]

    # Environment
    ENVIRONMENT: str = "development"

    # Scraping
    SCRAPER_TIMEOUT: int = 30
    SCRAPER_MAX_RETRIES: int = 3

    # Scheduler (cron expressions)
    SCRAPE_PRODUCTS_CRON: str = "0 3 * * *"  # 3 AM daily
    UPDATE_MARKET_PRICES_CRON: str = "0 */12 * * *"  # Every 12 hours

    # Cache TTL (seconds)
    CACHE_TTL_PRODUCTS: int = 300  # 5 minutes
    CACHE_TTL_MARKET_PRICES: int = 43200  # 12 hours

    # Rate Limiting
    RATE_LIMIT_PUBLIC: str = "100/minute"
    RATE_LIMIT_ADMIN: str = "1000/minute"

    # File Uploads
    UPLOAD_DIR: str = "uploads"
    MAX_UPLOAD_SIZE: int = 10 * 1024 * 1024  # 10 MB
    ALLOWED_IMAGE_TYPES_STR: str = "image/jpeg,image/png,image/webp,image/gif"

    @property
    def ALLOWED_IMAGE_TYPES(self) -> List[str]:
        """Parse ALLOWED_IMAGE_TYPES from string."""
        v = self.ALLOWED_IMAGE_TYPES_STR
        try:
            parsed = json.loads(v)
            if isinstance(parsed, list):
                return parsed
        except json.JSONDecodeError:
            pass
        return [t.strip() for t in v.split(',') if t.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production"

    @property
    def is_development(self) -> bool:
        return self.ENVIRONMENT == "development"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance."""
    return Settings()


settings = get_settings()
