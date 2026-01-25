"""In-memory cache service."""
from typing import Optional, Any, Callable
from functools import wraps
import hashlib
import json
from cachetools import TTLCache

from app.config import settings


class CacheService:
    """
    Simple in-memory cache with TTL.

    Uses cachetools for efficient TTL-based caching.
    Can be replaced with Redis later if needed.
    """

    def __init__(self):
        # Separate caches for different data types
        self._product_cache = TTLCache(
            maxsize=500,
            ttl=settings.CACHE_TTL_PRODUCTS
        )
        self._market_cache = TTLCache(
            maxsize=100,
            ttl=settings.CACHE_TTL_MARKET_PRICES
        )
        self._general_cache = TTLCache(
            maxsize=200,
            ttl=300  # 5 minutes default
        )

    def _make_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate cache key from arguments."""
        key_data = json.dumps({"args": args, "kwargs": kwargs}, sort_keys=True, default=str)
        hash_value = hashlib.md5(key_data.encode()).hexdigest()[:12]
        return f"{prefix}:{hash_value}"

    # Product cache methods

    def get_product(self, key: str) -> Optional[Any]:
        """Get from product cache."""
        return self._product_cache.get(key)

    def set_product(self, key: str, value: Any) -> None:
        """Set in product cache."""
        self._product_cache[key] = value

    def invalidate_product(self, key: str) -> None:
        """Invalidate product cache entry."""
        self._product_cache.pop(key, None)

    def invalidate_all_products(self) -> None:
        """Clear all product cache."""
        self._product_cache.clear()

    # Market cache methods

    def get_market(self, key: str) -> Optional[Any]:
        """Get from market cache."""
        return self._market_cache.get(key)

    def set_market(self, key: str, value: Any) -> None:
        """Set in market cache."""
        self._market_cache[key] = value

    def invalidate_market(self, key: str) -> None:
        """Invalidate market cache entry."""
        self._market_cache.pop(key, None)

    # General cache methods

    def get(self, key: str) -> Optional[Any]:
        """Get from general cache."""
        return self._general_cache.get(key)

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set in general cache."""
        self._general_cache[key] = value

    def invalidate(self, key: str) -> None:
        """Invalidate general cache entry."""
        self._general_cache.pop(key, None)


# Global cache instance
cache = CacheService()


def cached(prefix: str, ttl_seconds: Optional[int] = None):
    """
    Decorator for caching function results.

    Usage:
        @cached("products", ttl_seconds=300)
        def get_products():
            ...
    """
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            key = cache._make_key(prefix, *args, **kwargs)

            # Try to get from cache
            result = cache.get(key)
            if result is not None:
                return result

            # Execute function and cache result
            result = func(*args, **kwargs)
            cache.set(key, result)
            return result

        return wrapper
    return decorator
