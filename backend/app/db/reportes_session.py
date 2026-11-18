"""Conexión de solo lectura para el módulo de reportes.

- Si está REPORTS_DATABASE_URL (usuario reportes_ro) se usa un engine propio,
  chico, separado del pool principal.
- Si no, se reutiliza el engine principal.
En los dos casos cada request corre en una transacción READ ONLY con
statement_timeout (SET LOCAL: vale solo para esa transacción) y se descarta
con rollback al terminar: los reportes nunca escriben.
"""
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Connection, Engine

from app.config import settings
from app.db.session import engine as main_engine

_reportes_engine: Engine | None = None


def get_reportes_engine() -> Engine:
    global _reportes_engine
    if not settings.REPORTS_DATABASE_URL:
        return main_engine
    if _reportes_engine is None:
        _reportes_engine = create_engine(
            settings.REPORTS_DATABASE_URL,
            pool_size=2,
            max_overflow=2,
            pool_pre_ping=True,
            pool_recycle=3600,
        )
    return _reportes_engine


def abrir_transaccion_lectura(conn: Connection) -> None:
    """Primera sentencia de la transacción: la deja en solo lectura y con
    timeout. Debe ejecutarse antes de cualquier consulta."""
    conn.execute(text("SET TRANSACTION READ ONLY"))
    timeout_ms = int(settings.REPORTS_STATEMENT_TIMEOUT_MS)
    conn.execute(text(f"SET LOCAL statement_timeout = {timeout_ms}"))


def get_reportes_db() -> Generator[Connection, None, None]:
    """Dependency de FastAPI: una conexión en transacción de solo lectura."""
    with get_reportes_engine().connect() as conn:
        trans = conn.begin()
        try:
            abrir_transaccion_lectura(conn)
            yield conn
        finally:
            trans.rollback()
