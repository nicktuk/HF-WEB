"""Reportes de negocio — /api/v1/admin/reportes/*.

Endpoints delgados: validan parámetros, delegan en services/reportes.py y
formatean la salida (JSON o CSV). Acceso: API key de admin (superadmin) o
token de solo lectura REPORTS_API_TOKEN (ver core/reports_auth.py).
"""
import json
from datetime import date
from decimal import Decimal
from typing import Any, Callable, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.exc import OperationalError

from app.core.reports_auth import ReportesAcceso, instalar_filtro_logs, require_reportes_access
from app.db.reportes_session import get_reportes_db
from app.services import reportes as svc

instalar_filtro_logs()

router = APIRouter()

Formato = Literal["json", "csv"]


def _json_default(o: Any):
    # Montos: string decimal exacto (nunca float).
    if isinstance(o, Decimal):
        return format(o, "f")
    if isinstance(o, date):
        return o.isoformat()
    raise TypeError(f"No serializable: {type(o)!r}")


def _responder(data: dict, formato: str, nombre: str, filas: Callable[[dict], list[dict]]) -> Response:
    headers = {"Cache-Control": "no-store"}
    if formato == "csv":
        filtros = data.get("filtros", {})
        sufijo = "-".join(str(filtros[k]) for k in ("desde", "hasta") if filtros.get(k))
        filename = f"reporte-{nombre}{'-' + sufijo if sufijo else ''}.csv"
        headers["Content-Disposition"] = f'attachment; filename="{filename}"'
        return Response(content=svc.a_csv(filas(data)), media_type="text/csv; charset=utf-8", headers=headers)
    body = json.dumps(data, default=_json_default, ensure_ascii=False)
    return Response(content=body, media_type="application/json", headers=headers)


def _ejecutar(fn: Callable[[], dict]) -> dict:
    try:
        return fn()
    except OperationalError as exc:
        if getattr(getattr(exc, "orig", None), "pgcode", None) == "57014":
            raise HTTPException(status_code=504, detail="La consulta tardó más de lo permitido: probá con un rango más corto")
        raise


class FiltrosComunes:
    def __init__(
        self,
        desde: Optional[date] = Query(None, description="Fecha inicial inclusiva (AAAA-MM-DD, hora de Buenos Aires). Default: hasta - 29 días"),
        hasta: Optional[date] = Query(None, description="Fecha final inclusiva. Default: hoy"),
        canal: Optional[Literal["admin", "vendedor"]] = Query(None, description="admin = cargadas en el admin; vendedor = bot de WhatsApp"),
        deposito_id: Optional[int] = Query(None),
        vendedora_id: Optional[int] = Query(None),
        estado: Literal["todas", "entregadas", "cobradas"] = Query("todas"),
        agrupar: Optional[Literal["dia", "semana", "mes"]] = Query(None, description="Default según el largo del rango"),
        formato: Formato = Query("json"),
    ):
        self.desde = desde
        self.hasta = hasta
        self.canal = canal
        self.deposito_id = deposito_id
        self.vendedora_id = vendedora_id
        self.estado = estado
        self.agrupar = agrupar
        self.formato = formato

    def armar(self, conn) -> svc.Filtros:
        return svc.armar_filtros(
            conn, self.desde, self.hasta, self.canal, self.deposito_id,
            self.vendedora_id, self.estado, self.agrupar,
        )


@router.get("/resumen")
def get_resumen(
    q: FiltrosComunes = Depends(),
    acceso: ReportesAcceso = Depends(require_reportes_access),
    conn=Depends(get_reportes_db),
):
    """KPIs del período y comparación contra el período anterior de igual duración."""
    data = _ejecutar(lambda: svc.resumen(conn, q.armar(conn)))
    return _responder(data, q.formato, "resumen", svc.resumen_filas_csv)


@router.get("/ventas")
def get_ventas(
    q: FiltrosComunes = Depends(),
    acceso: ReportesAcceso = Depends(require_reportes_access),
    conn=Depends(get_reportes_db),
):
    """Serie temporal de facturación, ventas y unidades, abierta por canal."""
    data = _ejecutar(lambda: svc.ventas(conn, q.armar(conn)))
    return _responder(data, q.formato, "ventas", svc.ventas_filas_csv)


@router.get("/productos")
def get_productos(
    q: FiltrosComunes = Depends(),
    orden: str = Query("facturacion", description=", ".join(svc.ORDENES_PRODUCTOS)),
    direccion: Literal["asc", "desc"] = Query("desc"),
    top: Optional[int] = Query(None, ge=1, le=1000),
    bottom: Optional[int] = Query(None, ge=1, le=1000),
    acceso: ReportesAcceso = Depends(require_reportes_access),
    conn=Depends(get_reportes_db),
):
    """Por producto: unidades, facturación, costo, margen, stock, cobertura y última venta."""
    data = _ejecutar(lambda: svc.productos(conn, q.armar(conn), orden, direccion, top, bottom))
    return _responder(data, q.formato, "productos", lambda d: d["productos"])


@router.get("/stock-inmovilizado")
def get_stock_inmovilizado(
    deposito_id: Optional[int] = Query(None),
    dias_min: int = Query(60, ge=0, le=3650),
    formato: Formato = Query("json"),
    acceso: ReportesAcceso = Depends(require_reportes_access),
    conn=Depends(get_reportes_db),
):
    """Stock actual sin ventas hace `dias_min` días o más, valuado a costo, por depósito."""
    data = _ejecutar(lambda: svc.stock_inmovilizado(conn, deposito_id, dias_min))
    return _responder(data, formato, "stock-inmovilizado", lambda d: d["items"])


@router.get("/vendedoras")
def get_vendedoras(
    q: FiltrosComunes = Depends(),
    acceso: ReportesAcceso = Depends(require_reportes_access),
    conn=Depends(get_reportes_db),
):
    """Por vendedora: ventas, unidades, facturación, ticket, clientes y margen."""
    data = _ejecutar(lambda: svc.vendedoras(conn, q.armar(conn)))
    return _responder(data, q.formato, "vendedoras", lambda d: d["vendedoras"])


@router.get("/clientes")
def get_clientes(
    q: FiltrosComunes = Depends(),
    top: int = Query(50, ge=1, le=1000),
    orden: str = Query("facturacion", description=", ".join(svc.ORDENES_CLIENTES)),
    solo_una_compra: bool = Query(False),
    acceso: ReportesAcceso = Depends(require_reportes_access),
    conn=Depends(get_reportes_db),
):
    """Top clientes, frecuencia, última compra y clientes de una sola compra."""
    data = _ejecutar(lambda: svc.clientes(
        conn, q.armar(conn), acceso.datos_personales, top, orden, solo_una_compra,
    ))
    return _responder(data, q.formato, "clientes", lambda d: d["clientes"])


@router.get("/ciclo")
def get_ciclo(
    q: FiltrosComunes = Depends(),
    acceso: ReportesAcceso = Depends(require_reportes_access),
    conn=Depends(get_reportes_db),
):
    """Ciclo de vida de las ventas: tiempos venta→entrega→cobro, cobranza,
    plata que entró en el período y lo pendiente de cobrar/entregar."""
    data = _ejecutar(lambda: svc.ciclo(conn, q.armar(conn)))
    return _responder(data, q.formato, "ciclo", lambda d: d["pendientes"])
