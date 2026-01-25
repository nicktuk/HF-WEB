"""Security utilities - Authentication and rate limiting."""
from fastapi import Security, HTTPException, status, Request
from fastapi.security import APIKeyHeader
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

# API Key authentication
API_KEY_HEADER = APIKeyHeader(name="X-Admin-API-Key", auto_error=False)


def get_api_key() -> str:
    """Get the admin API key from settings."""
    return settings.ADMIN_API_KEY


async def verify_admin(api_key: str = Security(API_KEY_HEADER)) -> bool:
    """
    Verify admin API key.

    Usage:
        @router.post("/admin/products", dependencies=[Depends(verify_admin)])
        async def create_product(...):
            ...
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    if api_key != get_api_key():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return True


# Rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri="memory://",
)


def get_rate_limit_key(request: Request) -> str:
    """
    Custom key function for rate limiting.
    Uses API key for admin requests, IP for public.
    """
    api_key = request.headers.get("X-Admin-API-Key")
    if api_key:
        return f"admin:{api_key[:8]}"
    return get_remote_address(request)
