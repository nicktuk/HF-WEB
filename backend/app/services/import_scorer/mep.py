"""Cotización MEP (dólar bolsa) desde fuentes públicas."""
import httpx
from datetime import datetime
from typing import Optional


_cache: dict = {"cotizacion": None, "timestamp": None}
_CACHE_TTL_SECONDS = 1800  # 30 minutos


async def get_mep_rate() -> dict:
    """
    Obtiene cotización MEP desde Ambito Financiero o DolarAPI.
    Cachea el resultado 30 minutos para no saturar las fuentes.
    """
    now = datetime.utcnow()

    if (
        _cache["cotizacion"] is not None
        and _cache["timestamp"] is not None
        and (now - _cache["timestamp"]).total_seconds() < _CACHE_TTL_SECONDS
    ):
        return {
            "cotizacion": _cache["cotizacion"],
            "fuente": _cache.get("fuente", "cache"),
            "timestamp": _cache["timestamp"].isoformat(),
        }

    result = await _fetch_dolarapi()
    if result is None:
        result = await _fetch_ambito()

    if result is not None:
        _cache["cotizacion"] = result["cotizacion"]
        _cache["fuente"] = result["fuente"]
        _cache["timestamp"] = now
        return {
            "cotizacion": result["cotizacion"],
            "fuente": result["fuente"],
            "timestamp": now.isoformat(),
        }

    # Fallback: si hay cache viejo, devolver igual
    if _cache["cotizacion"] is not None:
        return {
            "cotizacion": _cache["cotizacion"],
            "fuente": "cache_stale",
            "timestamp": _cache["timestamp"].isoformat() if _cache["timestamp"] else now.isoformat(),
        }

    raise ValueError("No se pudo obtener cotización MEP de ninguna fuente")


async def _fetch_dolarapi() -> Optional[dict]:
    """Intenta obtener MEP desde dolarapi.com (JSON público, sin auth)."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get("https://dolarapi.com/v1/dolares/bolsa")
            if r.status_code == 200:
                data = r.json()
                venta = data.get("venta")
                if venta:
                    return {"cotizacion": float(venta), "fuente": "dolarapi.com"}
    except Exception:
        pass
    return None


async def _fetch_ambito() -> Optional[dict]:
    """Intenta obtener MEP desde Ambito Financiero."""
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(
                "https://mercados.ambito.com//dolar/mep/grafico/1-mes/datos",
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if r.status_code == 200:
                data = r.json()
                # Estructura: [[timestamp, valor], ...]
                if isinstance(data, list) and len(data) > 0:
                    last = data[-1]
                    if isinstance(last, list) and len(last) >= 2:
                        return {"cotizacion": float(last[1]), "fuente": "ambito.com"}
    except Exception:
        pass
    return None


def invalidate_mep_cache() -> None:
    _cache["cotizacion"] = None
    _cache["timestamp"] = None
