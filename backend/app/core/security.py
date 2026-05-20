"""Security utilities - Authentication and rate limiting."""
from dataclasses import dataclass
from typing import Optional

from fastapi import Security, HTTPException, status, Request, Depends
from fastapi.security import APIKeyHeader
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.config import settings
from app.db.session import get_db

API_KEY_HEADER = APIKeyHeader(name="X-Admin-API-Key", auto_error=False)


@dataclass
class AdminUserInfo:
    name: str
    api_key: str
    role: str  # "superadmin" | "product_editor"
    is_active: bool
    id: Optional[int] = None

    @property
    def is_superadmin(self) -> bool:
        return self.role == "superadmin"

    @property
    def is_product_editor(self) -> bool:
        return self.role == "product_editor"


def get_api_key() -> str:
    return settings.ADMIN_API_KEY


async def _lookup_admin_user(api_key: str, db: Session) -> AdminUserInfo:
    """Resolve an API key to an AdminUserInfo.

    Checks the admin_users table first; falls back to the static ADMIN_API_KEY
    env var (treated as superadmin) so existing deployments keep working before
    any users are added to the DB.
    """
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )
    try:
        from app.models.admin_user import AdminUser
        user = db.query(AdminUser).filter(
            AdminUser.api_key == api_key,
            AdminUser.is_active.is_(True),
        ).first()
        if user:
            return AdminUserInfo(
                id=user.id,
                name=user.name,
                api_key=user.api_key,
                role=user.role,
                is_active=user.is_active,
            )
    except Exception:
        pass  # table may not exist yet during first migration

    # Fallback: static key from environment = implicit superadmin
    if api_key == settings.ADMIN_API_KEY:
        return AdminUserInfo(name="Admin", api_key=api_key, role="superadmin", is_active=True)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid API key",
        headers={"WWW-Authenticate": "ApiKey"},
    )


async def get_admin_user(
    api_key: str = Security(API_KEY_HEADER),
    db: Session = Depends(get_db),
) -> AdminUserInfo:
    """FastAPI dependency — accepts any valid admin role."""
    return await _lookup_admin_user(api_key, db)


async def verify_admin(
    api_key: str = Security(API_KEY_HEADER),
    db: Session = Depends(get_db),
) -> bool:
    """FastAPI dependency — superadmin only. Used via dependencies=[Depends(verify_admin)]."""
    user = await _lookup_admin_user(api_key, db)
    if not user.is_superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )
    return True


# Rate limiter
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100/minute"],
    storage_uri="memory://",
)


def get_rate_limit_key(request: Request) -> str:
    api_key = request.headers.get("X-Admin-API-Key")
    if api_key:
        return f"admin:{api_key[:8]}"
    return get_remote_address(request)
