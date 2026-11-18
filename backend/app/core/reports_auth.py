"""Autenticación del módulo de reportes (/api/v1/admin/reportes/*).

Dos caminos, mismos endpoints:
1. Admin logueado: la API key del admin (header X-Admin-API-Key) con rol
   superadmin — el mismo mecanismo que el resto de /admin.
2. Token de solo lectura REPORTS_API_TOKEN, por header X-Reports-Token o por
   query param `token` (el asistente de IA solo hace GET simples por URL).
   - Comparación en tiempo constante.
   - Solo esta dependencia lo lee: en cualquier otra ruta no vale nada.
   - Si la variable está vacía, el camino queda deshabilitado.
   - Rate limit en memoria por IP (un solo worker en Railway).
   - Por este camino no se devuelven datos personales sensibles.
"""
import logging
import re
import secrets
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, Request, Security, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.security import API_KEY_HEADER, _lookup_admin_user
from app.db.session import get_db


@dataclass(frozen=True)
class ReportesAcceso:
    via: str  # "admin" | "token"

    @property
    def datos_personales(self) -> bool:
        """Teléfono/email de clientes: solo para el admin logueado."""
        return self.via == "admin"


class _RateLimiter:
    """Ventana deslizante de 60 s por clave. En memoria: alcanza con el único
    worker de uvicorn que corre en Railway."""

    def __init__(self) -> None:
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def permitir(self, clave: str, limite: int, ventana: float = 60.0) -> bool:
        ahora = time.monotonic()
        with self._lock:
            hits = self._hits[clave]
            while hits and ahora - hits[0] >= ventana:
                hits.popleft()
            if len(hits) >= limite:
                return False
            hits.append(ahora)
            return True

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


token_rate_limiter = _RateLimiter()


def _ip(request: Request) -> str:
    # Railway pone el IP real del cliente en X-Forwarded-For.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "desconocido"


def _no_autorizado(detalle: str = "No autorizado") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detalle)


async def require_reportes_access(
    request: Request,
    api_key: Optional[str] = Security(API_KEY_HEADER),
    x_reports_token: Optional[str] = Header(default=None, alias="X-Reports-Token"),
    token: Optional[str] = Query(default=None, description="Token de solo lectura (alternativa al header X-Reports-Token)"),
    db: Session = Depends(get_db),
) -> ReportesAcceso:
    if api_key:
        user = await _lookup_admin_user(api_key, db)
        if not user.is_superadmin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return ReportesAcceso(via="admin")

    provisto = x_reports_token or token
    if not provisto:
        raise _no_autorizado("Falta autenticación")

    esperado = settings.REPORTS_API_TOKEN
    if not esperado:
        raise _no_autorizado("Acceso por token deshabilitado")

    if not token_rate_limiter.permitir(_ip(request), int(settings.REPORTS_RATE_LIMIT_PER_MIN)):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiadas consultas: probá de nuevo en un minuto",
            headers={"Retry-After": "60"},
        )

    if not secrets.compare_digest(provisto.encode("utf-8"), esperado.encode("utf-8")):
        raise _no_autorizado("Token inválido")
    return ReportesAcceso(via="token")


class _RedactarTokenFilter(logging.Filter):
    """Evita que el token que llega por query param quede en los logs de
    acceso de uvicorn (y por lo tanto en los logs de Railway)."""

    _patron = re.compile(r"([?&]token=)[^&\s\"]*")

    def filter(self, record: logging.LogRecord) -> bool:
        if record.args and isinstance(record.args, tuple):
            record.args = tuple(
                self._patron.sub(r"\1***", a) if isinstance(a, str) else a for a in record.args
            )
        elif isinstance(record.msg, str):
            record.msg = self._patron.sub(r"\1***", record.msg)
        return True


def instalar_filtro_logs() -> None:
    logger = logging.getLogger("uvicorn.access")
    if not any(isinstance(f, _RedactarTokenFilter) for f in logger.filters):
        logger.addFilter(_RedactarTokenFilter())
