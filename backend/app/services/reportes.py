"""Reportes de negocio — canal minorista.

Toda la lógica de cálculo vive acá; los endpoints (admin y token de solo
lectura) solo llaman a estas funciones, así los dos caminos devuelven
exactamente lo mismo.

Reglas (ver también docs/reportes.md):
- Qué cuenta como venta: toda fila existente en `sales` con origen 'admin'
  (cargada en el admin) o 'vendedor' (bot de WhatsApp), que no sea espejo de
  un pedido mayorista. Quedan afuera la web y el mayorista. No existe estado
  "cancelada" en minorista: las ventas anuladas se borran físicamente, así
  que no aparecen. El filtro `estado` permite quedarse solo con las
  entregadas (`sales.delivered`) o las cobradas (`sales.paid`).
- Fecha de la venta: `sales.created_at` (UTC naive) llevada a
  America/Argentina/Buenos_Aires; `desde`/`hasta` son inclusivos.
- Facturación: suma de `sale_items.total_price`.
- Costo (opción B): promedio ponderado del precio de compra de los lotes
  (`stock_purchases`) del producto con fecha <= fecha de la venta (lotes a
  $0 se ignoran). Sin lotes previos: `products.original_price` (solo ARS) y
  se avisa en `advertencias` que es el costo actual. Sin ninguno: sin costo
  (`margen: null` a nivel producto, contador `items_sin_costo`).
- Montos: Decimal, nunca float. En JSON viajan como string decimal exacto.
"""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable, Optional

from sqlalchemy import text

from app.core.exceptions import ValidationError

TZ = "America/Argentina/Buenos_Aires"
CANALES = ("admin", "vendedor")
CANAL_LABEL = {"admin": "Admin", "vendedor": "Vendedor (bot)"}
ESTADOS = ("todas", "entregadas", "cobradas")
AGRUPACIONES = ("dia", "semana", "mes")
MAX_DIAS_RANGO = 1100

CENT = Decimal("0.01")
CERO = Decimal("0")

ADVERTENCIA_ALCANCE = (
    "Solo canal minorista (ventas cargadas en el admin y por el bot de vendedores): "
    "no incluye ventas web ni pedidos mayoristas."
)
ADVERTENCIA_COSTO = (
    "Costo = promedio ponderado de las compras del producto hasta la fecha de la venta. "
    "No es el costo exacto del lote consumido."
)

# Clave de cliente: nombre en minúsculas, sin espacios repetidos ni en los bordes.
_CLIENTE_KEY = r"NULLIF(lower(btrim(regexp_replace(COALESCE({col}, ''), '\s+', ' ', 'g'))), '')"


def _ck(col: str) -> str:
    return _CLIENTE_KEY.format(col=col)


# ─────────────────────────── filtros ───────────────────────────


@dataclass
class Filtros:
    desde: date
    hasta: date
    canal: Optional[str] = None
    deposito_id: Optional[int] = None
    vendedora_id: Optional[int] = None
    estado: str = "todas"
    agrupar: Optional[str] = None

    @property
    def dias(self) -> int:
        return (self.hasta - self.desde).days + 1

    def anterior(self) -> "Filtros":
        """Período inmediatamente anterior, de igual duración."""
        hasta = self.desde - timedelta(days=1)
        desde = hasta - timedelta(days=self.dias - 1)
        return Filtros(desde, hasta, self.canal, self.deposito_id, self.vendedora_id, self.estado, self.agrupar)

    def agrupacion(self) -> str:
        if self.agrupar:
            return self.agrupar
        if self.dias <= 62:
            return "dia"
        if self.dias <= 366:
            return "semana"
        return "mes"

    def as_dict(self) -> dict:
        return {
            "desde": self.desde.isoformat(),
            "hasta": self.hasta.isoformat(),
            "canal": self.canal,
            "deposito_id": self.deposito_id,
            "vendedora_id": self.vendedora_id,
            "estado": self.estado,
            "agrupar": self.agrupacion(),
            "zona_horaria": TZ,
        }


def hoy_local(conn) -> date:
    return conn.execute(text("SELECT (now() AT TIME ZONE :tz)::date"), {"tz": TZ}).scalar_one()


def armar_filtros(
    conn,
    desde: Optional[date],
    hasta: Optional[date],
    canal: Optional[str] = None,
    deposito_id: Optional[int] = None,
    vendedora_id: Optional[int] = None,
    estado: Optional[str] = None,
    agrupar: Optional[str] = None,
) -> Filtros:
    if canal is not None and canal not in CANALES:
        raise ValidationError(f"canal debe ser uno de: {', '.join(CANALES)}", field="canal")
    estado = estado or "todas"
    if estado not in ESTADOS:
        raise ValidationError(f"estado debe ser uno de: {', '.join(ESTADOS)}", field="estado")
    if agrupar is not None and agrupar not in AGRUPACIONES:
        raise ValidationError(f"agrupar debe ser uno de: {', '.join(AGRUPACIONES)}", field="agrupar")
    if desde is None or hasta is None:
        hoy = hoy_local(conn)
        if hasta is None:
            hasta = hoy if desde is None or desde <= hoy else desde
        if desde is None:
            desde = hasta - timedelta(days=29)
    if desde > hasta:
        raise ValidationError("desde no puede ser posterior a hasta", field="desde")
    if (hasta - desde).days + 1 > MAX_DIAS_RANGO:
        raise ValidationError(f"El rango no puede superar {MAX_DIAS_RANGO} días", field="desde")
    return Filtros(desde, hasta, canal, deposito_id, vendedora_id, estado, agrupar)


# ─────────────────────────── SQL base ───────────────────────────

# Rango de created_at (UTC naive) equivalente a [desde 00:00, hasta+1 00:00) en Buenos Aires.
_RANGO_UTC = (
    "s.created_at >= ((CAST(:desde AS date))::timestamp AT TIME ZONE :tz) AT TIME ZONE 'UTC' "
    "AND s.created_at < ((CAST(:hasta AS date) + 1)::timestamp AT TIME ZONE :tz) AT TIME ZONE 'UTC'"
)

_SOLO_MINORISTA = "s.origen IN ('admin', 'vendedor') AND s.pedido_mayorista_id IS NULL"


def _items_cte(f: Filtros) -> tuple[str, dict]:
    """CTEs `ventas` e `items`: los ítems de venta minorista del período con
    su costo unitario (opción B) y la fuente del costo."""
    params: dict[str, Any] = {"tz": TZ, "desde": f.desde, "hasta": f.hasta}
    filtros_venta = []
    if f.canal:
        filtros_venta.append("s.origen = :canal")
        params["canal"] = f.canal
    if f.vendedora_id is not None:
        filtros_venta.append("s.seller_id = :vendedora_id")
        params["vendedora_id"] = f.vendedora_id
    if f.estado == "entregadas":
        filtros_venta.append("s.delivered")
    elif f.estado == "cobradas":
        filtros_venta.append("s.paid")
    extra_venta = "".join(f" AND {x}" for x in filtros_venta)

    filtro_deposito = ""
    if f.deposito_id is not None:
        # Depósito del que salió el ítem (se graba al entregar); si todavía no
        # se entregó, el depósito de la vendedora.
        filtro_deposito = (
            " AND COALESCE(si.deposit_id, (SELECT d.id FROM deposits d "
            "WHERE d.seller_id = v.seller_id AND d.is_active ORDER BY d.id LIMIT 1)) = :deposito_id"
        )
        params["deposito_id"] = f.deposito_id

    sql = f"""
    ventas AS (
        SELECT s.id, s.seller_id, s.origen,
               {_ck('s.customer_name')} AS cliente_key,
               ((s.created_at AT TIME ZONE 'UTC') AT TIME ZONE :tz) AS fecha_local
        FROM sales s
        WHERE {_SOLO_MINORISTA} AND {_RANGO_UTC}{extra_venta}
    ),
    items AS (
        SELECT si.id, si.sale_id, v.seller_id, v.origen, v.cliente_key, v.fecha_local,
               si.product_id, si.quantity, si.total_price,
               c.costo_unitario, c.fuente
        FROM sale_items si
        JOIN ventas v ON v.id = si.sale_id
        LEFT JOIN products p ON p.id = si.product_id
        LEFT JOIN LATERAL (
            SELECT SUM(sp.quantity * sp.unit_price) / NULLIF(SUM(sp.quantity), 0) AS costo_lotes
            FROM stock_purchases sp
            WHERE sp.product_id = si.product_id
              AND sp.purchase_date <= v.fecha_local::date
              AND sp.unit_price > 0 AND sp.quantity > 0
        ) l ON si.product_id IS NOT NULL
        CROSS JOIN LATERAL (
            SELECT
                CASE WHEN l.costo_lotes IS NOT NULL THEN l.costo_lotes
                     WHEN p.original_price > 0 AND COALESCE(p.original_currency, 'ARS') = 'ARS' THEN p.original_price
                END AS costo_unitario,
                CASE WHEN l.costo_lotes IS NOT NULL THEN 'compras'
                     WHEN p.original_price > 0 AND COALESCE(p.original_currency, 'ARS') = 'ARS' THEN 'actual'
                END AS fuente
        ) c
        WHERE si.quantity > 0{filtro_deposito}
    )"""
    return sql, params


_AGREGADOS = """
    COUNT(DISTINCT sale_id) AS ventas,
    COALESCE(SUM(quantity), 0) AS unidades,
    COALESCE(SUM(total_price), 0) AS facturacion,
    COALESCE(SUM(total_price) FILTER (WHERE costo_unitario IS NOT NULL), 0) AS facturacion_con_costo,
    SUM(quantity * costo_unitario) AS costo,
    COUNT(*) FILTER (WHERE costo_unitario IS NULL) AS items_sin_costo,
    COUNT(*) FILTER (WHERE fuente = 'actual') AS items_costo_actual,
    COUNT(DISTINCT cliente_key) AS clientes_unicos
"""


# ─────────────────────────── helpers numéricos ───────────────────────────


def _dec(v: Any) -> Decimal:
    if v is None:
        return CERO
    return v if isinstance(v, Decimal) else Decimal(str(v))


def _money(v: Any) -> Optional[Decimal]:
    if v is None:
        return None
    return _dec(v).quantize(CENT, rounding=ROUND_HALF_UP)


def _pct(num: Any, den: Any) -> Optional[Decimal]:
    den = _dec(den)
    if den == 0:
        return None
    return (_dec(num) * 100 / den).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def _variacion(actual: Any, anterior: Any) -> Optional[Decimal]:
    """Variación % contra el período anterior; None si no hay base."""
    if actual is None or anterior is None:
        return None
    ant = _dec(anterior)
    if ant == 0:
        return None
    return ((_dec(actual) - ant) * 100 / abs(ant)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)


def _margen(fila: dict, parcial: bool) -> tuple[Optional[Decimal], Optional[Decimal]]:
    """Margen $ y %.

    parcial=True (agregados): margen sobre los ítems que tienen costo; None
    solo si ninguno tiene. parcial=False (un producto): None si algún ítem no
    tiene costo — no se inventa nada."""
    if fila["costo"] is None:
        return None, None
    if not parcial and fila["items_sin_costo"]:
        return None, None
    base = _dec(fila["facturacion_con_costo"])
    margen = base - _dec(fila["costo"])
    return _money(margen), _pct(margen, base)


def _advertencias_costo(items_sin_costo: int, items_costo_actual: int) -> list[str]:
    adv = [ADVERTENCIA_COSTO]
    if items_costo_actual:
        adv.append(
            f"{items_costo_actual} ítems sin compras previas a la venta: se valuaron al costo "
            "actual del proveedor (no histórico)."
        )
    if items_sin_costo:
        adv.append(
            f"{items_sin_costo} ítems sin costo cargado (productos sin compras ni precio de "
            "proveedor, o ítems manuales): el margen está incompleto."
        )
    return adv


# ─────────────────────────── series ───────────────────────────


def _bucket(d: date, agrupar: str) -> date:
    if agrupar == "semana":
        return d - timedelta(days=d.weekday())
    if agrupar == "mes":
        return d.replace(day=1)
    return d


def _buckets(f: Filtros, agrupar: str) -> list[date]:
    out: list[date] = []
    d = _bucket(f.desde, agrupar)
    while d <= f.hasta:
        out.append(d)
        if agrupar == "dia":
            d += timedelta(days=1)
        elif agrupar == "semana":
            d += timedelta(days=7)
        else:
            d = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
    return out


_UNIDAD_SQL = {"dia": "day", "semana": "week", "mes": "month"}


def _serie(conn, f: Filtros, agrupar: str, por_canal: bool = False) -> list[dict]:
    cte, params = _items_cte(f)
    params["unidad"] = _UNIDAD_SQL[agrupar]
    canal_col = ", origen" if por_canal else ""
    rows = conn.execute(text(f"""
        WITH {cte}
        SELECT date_trunc(:unidad, fecha_local)::date AS periodo{canal_col},
               COUNT(DISTINCT sale_id) AS ventas,
               COALESCE(SUM(quantity), 0) AS unidades,
               COALESCE(SUM(total_price), 0) AS facturacion
        FROM items
        GROUP BY 1{', 2' if por_canal else ''}
    """), params).mappings().all()

    vacio = lambda: {"facturacion": CERO, "ventas": 0, "unidades": 0}  # noqa: E731
    por_periodo: dict[date, dict] = {}
    for b in _buckets(f, agrupar):
        por_periodo[b] = {"total": vacio(), "por_canal": {c: vacio() for c in CANALES} if por_canal else None}
    for r in rows:
        slot = por_periodo.setdefault(r["periodo"], {"total": vacio(), "por_canal": {c: vacio() for c in CANALES} if por_canal else None})
        tot = slot["total"]
        tot["facturacion"] += _dec(r["facturacion"])
        tot["ventas"] += int(r["ventas"])
        tot["unidades"] += int(r["unidades"])
        if por_canal:
            slot["por_canal"][r["origen"]] = {
                "facturacion": _money(r["facturacion"]),
                "ventas": int(r["ventas"]),
                "unidades": int(r["unidades"]),
            }
    out = []
    for periodo in sorted(por_periodo):
        slot = por_periodo[periodo]
        item = {
            "periodo": periodo.isoformat(),
            "facturacion": _money(slot["total"]["facturacion"]),
            "ventas": slot["total"]["ventas"],
            "unidades": slot["total"]["unidades"],
        }
        if por_canal:
            item["por_canal"] = {c: {**v, "facturacion": _money(v["facturacion"])} for c, v in slot["por_canal"].items()}
        out.append(item)
    return out


# ─────────────────────────── /resumen ───────────────────────────


def _kpis(conn, f: Filtros) -> dict:
    cte, params = _items_cte(f)
    params["kh"] = f.hasta
    fila = dict(conn.execute(text(f"""
        WITH {cte},
        historico AS (
            SELECT {_ck('s.customer_name')} AS cliente_key, COUNT(*) AS compras
            FROM sales s
            WHERE {_SOLO_MINORISTA}
              AND s.created_at < ((CAST(:kh AS date) + 1)::timestamp AT TIME ZONE :tz) AT TIME ZONE 'UTC'
            GROUP BY 1
        ),
        clientes AS (SELECT DISTINCT cliente_key FROM items WHERE cliente_key IS NOT NULL)
        SELECT {_AGREGADOS},
               (SELECT COUNT(*) FROM clientes c JOIN historico h USING (cliente_key) WHERE h.compras >= 2) AS clientes_repiten,
               (SELECT COUNT(DISTINCT sale_id) FROM items WHERE cliente_key IS NULL) AS ventas_sin_cliente
        FROM items
    """), params).mappings().one())

    ventas = int(fila["ventas"])
    facturacion = _dec(fila["facturacion"])
    margen, margen_pct = _margen(fila, parcial=True)
    clientes = int(fila["clientes_unicos"])
    return {
        "facturacion": _money(facturacion),
        "ventas": ventas,
        "unidades": int(fila["unidades"]),
        "ticket_promedio": _money(facturacion / ventas) if ventas else None,
        "margen_bruto": margen,
        "margen_pct": margen_pct,
        "facturacion_con_costo": _money(fila["facturacion_con_costo"]),
        "costo": _money(fila["costo"]),
        "clientes_unicos": clientes,
        "clientes_repiten": int(fila["clientes_repiten"]),
        "pct_clientes_repiten": _pct(fila["clientes_repiten"], clientes),
        "ventas_sin_cliente": int(fila["ventas_sin_cliente"]),
        "items_sin_costo": int(fila["items_sin_costo"]),
        "items_costo_actual": int(fila["items_costo_actual"]),
    }


_KPIS_COMPARABLES = (
    "facturacion", "ventas", "unidades", "ticket_promedio", "margen_bruto",
    "margen_pct", "clientes_unicos", "pct_clientes_repiten",
)


def resumen(conn, f: Filtros) -> dict:
    actual = _kpis(conn, f)
    fa = f.anterior()
    anterior = _kpis(conn, fa)
    variacion = {}
    for k in _KPIS_COMPARABLES:
        if k in ("margen_pct", "pct_clientes_repiten"):
            # Para porcentajes, la diferencia en puntos es más útil que el %.
            a, b = actual[k], anterior[k]
            variacion[k] = None if a is None or b is None else (a - b).quantize(Decimal("0.1"))
        else:
            variacion[k] = _variacion(actual[k], anterior[k])

    agrupar = f.agrupacion()
    serie = _serie(conn, f, agrupar)
    serie_ant = _serie(conn, fa, agrupar)

    adv = [ADVERTENCIA_ALCANCE] + _advertencias_costo(actual["items_sin_costo"], actual["items_costo_actual"])
    if actual["ventas_sin_cliente"]:
        adv.append(
            f"{actual['ventas_sin_cliente']} ventas sin nombre de cliente: no cuentan para "
            "clientes únicos ni para el % que repite."
        )
    adv.append(
        "Clientes identificados por nombre (sin distinguir mayúsculas ni espacios): "
        "dos clientes con el mismo nombre cuentan como uno."
    )
    return {
        "filtros": f.as_dict(),
        "periodo_anterior": {"desde": fa.desde.isoformat(), "hasta": fa.hasta.isoformat()},
        "kpis": actual,
        "anterior": anterior,
        "variacion": variacion,
        "serie": serie,
        "serie_anterior": serie_ant,
        "items_sin_costo": actual["items_sin_costo"],
        "advertencias": adv,
    }


def resumen_filas_csv(data: dict) -> list[dict]:
    filas = []
    for k in _KPIS_COMPARABLES + ("costo", "facturacion_con_costo", "items_sin_costo", "ventas_sin_cliente"):
        filas.append({
            "indicador": k,
            "actual": data["kpis"].get(k),
            "anterior": data["anterior"].get(k),
            "variacion": data["variacion"].get(k),
        })
    return filas


# ─────────────────────────── /ventas ───────────────────────────


def ventas(conn, f: Filtros) -> dict:
    agrupar = f.agrupacion()
    serie = _serie(conn, f, agrupar, por_canal=True)
    total = {
        "facturacion": _money(sum((_dec(s["facturacion"]) for s in serie), CERO)),
        "ventas": sum(s["ventas"] for s in serie),
        "unidades": sum(s["unidades"] for s in serie),
    }
    return {
        "filtros": f.as_dict(),
        "agrupar": agrupar,
        "canales": [{"id": c, "nombre": CANAL_LABEL[c]} for c in CANALES],
        "serie": serie,
        "total": total,
        "advertencias": [ADVERTENCIA_ALCANCE],
    }


def ventas_filas_csv(data: dict) -> list[dict]:
    filas = []
    for s in data["serie"]:
        fila = {"periodo": s["periodo"], "facturacion": s["facturacion"], "ventas": s["ventas"], "unidades": s["unidades"]}
        for c, v in s["por_canal"].items():
            fila[f"facturacion_{c}"] = v["facturacion"]
            fila[f"ventas_{c}"] = v["ventas"]
            fila[f"unidades_{c}"] = v["unidades"]
        filas.append(fila)
    return filas


# ─────────────────────────── stock por depósito ───────────────────────────

# Stock total = lotes (stock_purchases: quantity - out_quantity), que es la
# fuente de verdad del total. El reparto por depósito es el que muestra el
# admin (product_color_stock si el producto tiene colores con depósito; si
# no, product_deposit_stock). Lo que el reparto no cubre va a "Sin asignar"
# (deposito_id NULL).
_STOCK_CTE = """
    stock_total AS (
        SELECT product_id, SUM(quantity - out_quantity) AS total
        FROM stock_purchases
        WHERE product_id IS NOT NULL
        GROUP BY product_id
    ),
    color_dep AS (
        SELECT product_id, deposit_id, SUM(quantity) AS q
        FROM product_color_stock
        WHERE deposit_id IS NOT NULL
        GROUP BY product_id, deposit_id
    ),
    reparto AS (
        SELECT product_id, deposit_id, q FROM color_dep
        UNION ALL
        SELECT pds.product_id, pds.deposit_id, pds.quantity
        FROM product_deposit_stock pds
        WHERE NOT EXISTS (SELECT 1 FROM color_dep cd WHERE cd.product_id = pds.product_id)
    ),
    asignado AS (
        SELECT product_id, SUM(q) AS q FROM reparto WHERE q > 0 GROUP BY product_id
    ),
    stock_dep AS (
        SELECT product_id, deposit_id, q AS stock FROM reparto WHERE q > 0
        UNION ALL
        SELECT st.product_id, NULL::integer, st.total - COALESCE(a.q, 0)
        FROM stock_total st LEFT JOIN asignado a USING (product_id)
        WHERE st.total - COALESCE(a.q, 0) > 0
    ),
    excedidos AS (
        SELECT COUNT(*) AS n
        FROM asignado a LEFT JOIN stock_total st USING (product_id)
        WHERE a.q > GREATEST(COALESCE(st.total, 0), 0)
    )
"""


# ─────────────────────────── /productos ───────────────────────────

ORDENES_PRODUCTOS = ("facturacion", "unidades", "margen", "margen_pct", "costo", "stock", "dias_cobertura", "ultima_venta")


def productos(
    conn,
    f: Filtros,
    orden: str = "facturacion",
    direccion: str = "desc",
    top: Optional[int] = None,
    bottom: Optional[int] = None,
) -> dict:
    if orden not in ORDENES_PRODUCTOS:
        raise ValidationError(f"orden debe ser uno de: {', '.join(ORDENES_PRODUCTOS)}", field="orden")
    if direccion not in ("asc", "desc"):
        raise ValidationError("direccion debe ser asc o desc", field="direccion")
    if top is not None and bottom is not None:
        raise ValidationError("Usá top o bottom, no los dos", field="top")

    cte, params = _items_cte(f)
    if f.deposito_id is not None:
        stock_expr = "(SELECT COALESCE(SUM(sd.stock), 0) FROM stock_dep sd WHERE sd.product_id = pp.product_id AND sd.deposit_id = :deposito_id)"
    else:
        stock_expr = "(SELECT GREATEST(COALESCE(st.total, 0), 0) FROM stock_total st WHERE st.product_id = pp.product_id)"

    rows = conn.execute(text(f"""
        WITH {cte}, {_STOCK_CTE},
        por_producto AS (
            SELECT product_id,
                   COALESCE(SUM(quantity), 0) AS unidades,
                   COALESCE(SUM(total_price), 0) AS facturacion,
                   COALESCE(SUM(total_price) FILTER (WHERE costo_unitario IS NOT NULL), 0) AS facturacion_con_costo,
                   SUM(quantity * costo_unitario) AS costo,
                   COUNT(*) FILTER (WHERE costo_unitario IS NULL) AS items_sin_costo,
                   COUNT(*) FILTER (WHERE fuente = 'actual') AS items_costo_actual
            FROM items
            WHERE product_id IS NOT NULL
            GROUP BY product_id
        )
        SELECT pp.*, p.codigo_interno, p.sku,
               COALESCE(NULLIF(p.custom_name, ''), p.original_name) AS nombre,
               COALESCE({stock_expr}, 0) AS stock,
               (SELECT MAX(((s.created_at AT TIME ZONE 'UTC') AT TIME ZONE :tz)::date)
                  FROM sale_items si JOIN sales s ON s.id = si.sale_id
                 WHERE si.product_id = pp.product_id AND {_SOLO_MINORISTA}) AS ultima_venta
        FROM por_producto pp
        JOIN products p ON p.id = pp.product_id
    """), params).mappings().all()

    manuales = dict(conn.execute(text(f"""
        WITH {cte}
        SELECT COUNT(*) AS items, COALESCE(SUM(total_price), 0) AS facturacion
        FROM items WHERE product_id IS NULL
    """), params).mappings().one())

    dias = Decimal(f.dias)
    lista = []
    for r in rows:
        r = dict(r)
        margen, margen_pct = _margen(r, parcial=False)
        unidades = int(r["unidades"])
        stock = int(r["stock"])
        venta_diaria = Decimal(unidades) / dias if unidades else CERO
        cobertura = (Decimal(stock) / venta_diaria).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP) if venta_diaria else None
        lista.append({
            "product_id": r["product_id"],
            "codigo_interno": r["codigo_interno"],
            "sku": r["sku"],
            "nombre": r["nombre"],
            "unidades": unidades,
            "facturacion": _money(r["facturacion"]),
            "costo": _money(r["costo"]) if not r["items_sin_costo"] else None,
            "margen": margen,
            "margen_pct": margen_pct,
            "costo_actual": bool(r["items_costo_actual"]),
            "items_sin_costo": int(r["items_sin_costo"]),
            "stock": stock,
            "dias_cobertura": cobertura,
            "ultima_venta": r["ultima_venta"].isoformat() if r["ultima_venta"] else None,
        })

    # Ordenar: los None siempre al final.
    con_valor = [x for x in lista if x[orden] is not None]
    sin_valor = [x for x in lista if x[orden] is None]
    if top is not None:
        direccion = "desc"
    elif bottom is not None:
        direccion = "asc"
    con_valor.sort(key=lambda x: x[orden], reverse=(direccion == "desc"))
    ordenada = con_valor + sin_valor
    limite = top if top is not None else bottom
    total_productos = len(ordenada)
    if limite is not None:
        ordenada = ordenada[:limite]

    items_sin_costo = sum(x["items_sin_costo"] for x in lista) + int(manuales["items"])
    items_costo_actual = sum(int(r["items_costo_actual"]) for r in rows)
    sin_costo_productos = sum(1 for x in lista if x["margen"] is None)
    adv = [ADVERTENCIA_ALCANCE] + _advertencias_costo(items_sin_costo, items_costo_actual)
    if sin_costo_productos:
        adv.append(f"{sin_costo_productos} productos sin costo cargado: su margen figura vacío.")
    if manuales["items"]:
        adv.append(
            f"{manuales['items']} ítems manuales (sin producto asociado) por "
            f"$ {_money(manuales['facturacion'])}: no tienen SKU ni costo y no aparecen en la lista."
        )
    if f.deposito_id is not None:
        adv.append("Stock: solo el del depósito filtrado (según el reparto manual por depósito).")
    adv.append("Días de cobertura = stock actual / venta diaria promedio del período.")

    return {
        "filtros": f.as_dict(),
        "orden": orden,
        "direccion": direccion,
        "total_productos": total_productos,
        "productos": ordenada,
        "items_manuales": {"items": int(manuales["items"]), "facturacion": _money(manuales["facturacion"])},
        "items_sin_costo": items_sin_costo,
        "advertencias": adv,
    }


# ─────────────────────────── /stock-inmovilizado ───────────────────────────


def stock_inmovilizado(conn, deposito_id: Optional[int] = None, dias_min: int = 60) -> dict:
    if dias_min < 0:
        raise ValidationError("dias_min no puede ser negativo", field="dias_min")
    params: dict[str, Any] = {"tz": TZ, "dias_min": dias_min}
    filtro_dep = ""
    if deposito_id is not None:
        filtro_dep = "AND sd.deposit_id = :deposito_id"
        params["deposito_id"] = deposito_id

    rows = conn.execute(text(f"""
        WITH {_STOCK_CTE},
        hoy AS (SELECT (now() AT TIME ZONE :tz)::date AS d),
        costo_stock AS (
            SELECT product_id,
                   SUM((quantity - out_quantity) * unit_price) / NULLIF(SUM(quantity - out_quantity), 0) AS costo
            FROM stock_purchases
            WHERE product_id IS NOT NULL AND quantity - out_quantity > 0 AND unit_price > 0
            GROUP BY product_id
        ),
        ultima AS (
            SELECT si.product_id, MAX(s.created_at) AS ultima
            FROM sale_items si JOIN sales s ON s.id = si.sale_id
            WHERE si.product_id IS NOT NULL
            GROUP BY si.product_id
        ),
        ingreso AS (
            SELECT product_id, MIN(purchase_date) AS primera_compra
            FROM stock_purchases WHERE product_id IS NOT NULL GROUP BY product_id
        ),
        base AS (
            SELECT sd.deposit_id, sd.product_id, sd.stock,
                   COALESCE(NULLIF(p.custom_name, ''), p.original_name) AS nombre,
                   p.codigo_interno, p.sku,
                   CASE WHEN cs.costo IS NOT NULL THEN cs.costo
                        WHEN p.original_price > 0 AND COALESCE(p.original_currency, 'ARS') = 'ARS' THEN p.original_price
                   END AS costo_unitario,
                   CASE WHEN cs.costo IS NOT NULL THEN 'compras'
                        WHEN p.original_price > 0 AND COALESCE(p.original_currency, 'ARS') = 'ARS' THEN 'actual'
                   END AS fuente,
                   (((u.ultima AT TIME ZONE 'UTC') AT TIME ZONE :tz))::date AS ultima_venta,
                   i.primera_compra,
                   (SELECT d FROM hoy) - COALESCE((((u.ultima AT TIME ZONE 'UTC') AT TIME ZONE :tz))::date, i.primera_compra) AS dias_sin_venta
            FROM stock_dep sd
            JOIN products p ON p.id = sd.product_id
            LEFT JOIN costo_stock cs ON cs.product_id = sd.product_id
            LEFT JOIN ultima u ON u.product_id = sd.product_id
            LEFT JOIN ingreso i ON i.product_id = sd.product_id
            WHERE sd.stock > 0 {filtro_dep}
        )
        SELECT b.*, d.name AS deposito
        FROM base b
        LEFT JOIN deposits d ON d.id = b.deposit_id
        WHERE b.dias_sin_venta IS NULL OR b.dias_sin_venta >= :dias_min
        ORDER BY b.deposit_id NULLS LAST, b.dias_sin_venta DESC NULLS FIRST
    """), params).mappings().all()

    excedidos = conn.execute(text(f"WITH {_STOCK_CTE} SELECT n FROM excedidos")).scalar_one()

    items = []
    depositos: dict[Any, dict] = {}
    sin_costo = 0
    costo_actual = 0
    for r in rows:
        costo_u = r["costo_unitario"]
        valor = _money(_dec(costo_u) * r["stock"]) if costo_u is not None else None
        if costo_u is None:
            sin_costo += 1
        elif r["fuente"] == "actual":
            costo_actual += 1
        dep_nombre = r["deposito"] or "Sin asignar"
        items.append({
            "deposito_id": r["deposit_id"],
            "deposito": dep_nombre,
            "product_id": r["product_id"],
            "codigo_interno": r["codigo_interno"],
            "sku": r["sku"],
            "nombre": r["nombre"],
            "stock": int(r["stock"]),
            "costo_unitario": _money(costo_u),
            "costo_actual": r["fuente"] == "actual",
            "valor_costo": valor,
            "ultima_venta": r["ultima_venta"].isoformat() if r["ultima_venta"] else None,
            "nunca_vendido": r["ultima_venta"] is None,
            "primera_compra": r["primera_compra"].isoformat() if r["primera_compra"] else None,
            "dias_sin_venta": int(r["dias_sin_venta"]) if r["dias_sin_venta"] is not None else None,
        })
        dep = depositos.setdefault(r["deposit_id"], {
            "deposito_id": r["deposit_id"], "deposito": dep_nombre,
            "productos": 0, "unidades": 0, "valor_costo": CERO, "productos_sin_costo": 0,
        })
        dep["productos"] += 1
        dep["unidades"] += int(r["stock"])
        if valor is not None:
            dep["valor_costo"] += valor
        else:
            dep["productos_sin_costo"] += 1

    por_deposito = sorted(depositos.values(), key=lambda d: d["valor_costo"], reverse=True)
    for d in por_deposito:
        d["valor_costo"] = _money(d["valor_costo"])
    total = _money(sum((_dec(d["valor_costo"]) for d in por_deposito), CERO))

    adv = [
        "Foto del stock actual: no depende de las fechas del filtro.",
        f"Incluye productos sin ventas (de cualquier canal) hace {dias_min} días o más; "
        "si nunca se vendieron, se cuenta desde la primera compra.",
        "Valuación = stock × costo promedio de lo que queda de cada lote de compra.",
        "Stock por depósito según el reparto manual del admin; lo que no está repartido figura como 'Sin asignar'.",
    ]
    if costo_actual:
        adv.append(f"{costo_actual} productos sin lotes con costo: valuados al costo actual del proveedor.")
    if sin_costo:
        adv.append(f"{sin_costo} productos sin costo cargado: no suman a la plata parada.")
    if excedidos:
        adv.append(
            f"{excedidos} productos tienen más unidades repartidas en depósitos que stock total "
            "en compras: revisar el reparto."
        )
    return {
        "filtros": {"deposito_id": deposito_id, "dias_min": dias_min, "zona_horaria": TZ},
        "total_valor_costo": total,
        "por_deposito": por_deposito,
        "items": items,
        "items_sin_costo": sin_costo,
        "advertencias": adv,
    }


# ─────────────────────────── /vendedoras ───────────────────────────


def vendedoras(conn, f: Filtros) -> dict:
    cte, params = _items_cte(f)
    rows = conn.execute(text(f"""
        WITH {cte}
        SELECT i.seller_id, cs.nombre, {_AGREGADOS}
        FROM items i
        JOIN catalog_sellers cs ON cs.id = i.seller_id
        GROUP BY i.seller_id, cs.nombre
        ORDER BY facturacion DESC
    """), params).mappings().all()

    lista = []
    sin_costo = 0
    costo_actual = 0
    for r in rows:
        r = dict(r)
        ventas_n = int(r["ventas"])
        fact = _dec(r["facturacion"])
        margen, margen_pct = _margen(r, parcial=True)
        sin_costo += int(r["items_sin_costo"])
        costo_actual += int(r["items_costo_actual"])
        lista.append({
            "vendedora_id": r["seller_id"],
            "nombre": r["nombre"],
            "ventas": ventas_n,
            "unidades": int(r["unidades"]),
            "facturacion": _money(fact),
            "ticket_promedio": _money(fact / ventas_n) if ventas_n else None,
            "clientes_unicos": int(r["clientes_unicos"]),
            "margen": margen,
            "margen_pct": margen_pct,
            "items_sin_costo": int(r["items_sin_costo"]),
            "base_comisionable": None,
        })
    adv = [ADVERTENCIA_ALCANCE] + _advertencias_costo(sin_costo, costo_actual)
    adv.append("base_comisionable: pendiente de definición (siempre null por ahora).")
    return {"filtros": f.as_dict(), "vendedoras": lista, "items_sin_costo": sin_costo, "advertencias": adv}


# ─────────────────────────── /clientes ───────────────────────────

ORDENES_CLIENTES = ("facturacion", "ventas", "ultima_compra", "compras_totales")


def clientes(
    conn,
    f: Filtros,
    datos_personales: bool,
    top: int = 50,
    orden: str = "facturacion",
    solo_una_compra: bool = False,
) -> dict:
    if orden not in ORDENES_CLIENTES:
        raise ValidationError(f"orden debe ser uno de: {', '.join(ORDENES_CLIENTES)}", field="orden")
    cte, params = _items_cte(f)
    params["kh"] = f.hasta
    rows = conn.execute(text(f"""
        WITH {cte},
        hist_ventas AS (
            SELECT s.id, {_ck('s.customer_name')} AS cliente_key, s.customer_name,
                   s.shipping_city, s.phone, s.email, s.created_at
            FROM sales s
            WHERE {_SOLO_MINORISTA}
              AND s.created_at < ((CAST(:kh AS date) + 1)::timestamp AT TIME ZONE :tz) AT TIME ZONE 'UTC'
        ),
        historico AS (
            SELECT cliente_key, COUNT(*) AS compras_totales,
                   MIN(((created_at AT TIME ZONE 'UTC') AT TIME ZONE :tz)::date) AS primera_compra,
                   MAX(((created_at AT TIME ZONE 'UTC') AT TIME ZONE :tz)::date) AS ultima_compra
            FROM hist_ventas WHERE cliente_key IS NOT NULL GROUP BY cliente_key
        ),
        periodo AS (
            SELECT cliente_key, COUNT(DISTINCT sale_id) AS ventas,
                   COALESCE(SUM(total_price), 0) AS facturacion,
                   COALESCE(SUM(quantity), 0) AS unidades
            FROM items WHERE cliente_key IS NOT NULL GROUP BY cliente_key
        ),
        nombre AS (
            SELECT DISTINCT ON (cliente_key) cliente_key, btrim(customer_name) AS nombre
            FROM hist_ventas WHERE cliente_key IS NOT NULL
            ORDER BY cliente_key, created_at DESC
        ),
        localidad AS (
            SELECT DISTINCT ON (cliente_key) cliente_key, shipping_city AS localidad
            FROM hist_ventas WHERE cliente_key IS NOT NULL AND NULLIF(btrim(shipping_city), '') IS NOT NULL
            ORDER BY cliente_key, created_at DESC
        ),
        contacto AS (
            SELECT hv.cliente_key,
                   (SELECT h2.phone FROM hist_ventas h2 WHERE h2.cliente_key = hv.cliente_key AND NULLIF(btrim(h2.phone), '') IS NOT NULL ORDER BY h2.created_at DESC LIMIT 1) AS telefono,
                   (SELECT h2.email FROM hist_ventas h2 WHERE h2.cliente_key = hv.cliente_key AND NULLIF(btrim(h2.email), '') IS NOT NULL ORDER BY h2.created_at DESC LIMIT 1) AS email
            FROM (SELECT DISTINCT cliente_key FROM periodo) hv
        )
        SELECT p.*, h.compras_totales, h.primera_compra, h.ultima_compra,
               n.nombre, l.localidad,
               COALESCE(c.telefono, cu.phone) AS telefono,
               COALESCE(c.email, cu.email) AS email
        FROM periodo p
        JOIN historico h USING (cliente_key)
        JOIN nombre n USING (cliente_key)
        LEFT JOIN localidad l USING (cliente_key)
        LEFT JOIN contacto c USING (cliente_key)
        LEFT JOIN customers cu ON {_ck('cu.name')} = p.cliente_key
    """), params).mappings().all()

    lista = []
    for r in rows:
        compras = int(r["compras_totales"])
        frecuencia = None
        if compras > 1 and r["primera_compra"] and r["ultima_compra"]:
            frecuencia = (Decimal((r["ultima_compra"] - r["primera_compra"]).days) / (compras - 1)).quantize(
                Decimal("0.1"), rounding=ROUND_HALF_UP
            )
        c = {
            "nombre": r["nombre"],
            "localidad": r["localidad"],
            "ventas": int(r["ventas"]),
            "unidades": int(r["unidades"]),
            "facturacion": _money(r["facturacion"]),
            "compras_totales": compras,
            "primera_compra": r["primera_compra"].isoformat() if r["primera_compra"] else None,
            "ultima_compra": r["ultima_compra"].isoformat() if r["ultima_compra"] else None,
            "dias_promedio_entre_compras": frecuencia,
            "una_sola_compra": compras == 1,
        }
        if datos_personales:
            c["telefono"] = r["telefono"]
            c["email"] = r["email"]
        lista.append(c)

    total_clientes = len(lista)
    repiten = sum(1 for c in lista if c["compras_totales"] >= 2)
    una_sola = total_clientes - repiten
    ventas_sin_cliente = conn.execute(text(f"""
        WITH {cte} SELECT COUNT(DISTINCT sale_id) FROM items WHERE cliente_key IS NULL
    """), {k: v for k, v in params.items() if k != "kh"}).scalar_one()

    if solo_una_compra:
        lista = [c for c in lista if c["una_sola_compra"]]
    lista.sort(key=lambda c: (c[orden] is not None, c[orden] or 0), reverse=True)
    lista = lista[:top]

    adv = [
        ADVERTENCIA_ALCANCE,
        "Clientes identificados por nombre (sin distinguir mayúsculas ni espacios): "
        "dos clientes con el mismo nombre cuentan como uno.",
        "compras_totales, primera/última compra y frecuencia: historial minorista completo hasta 'hasta'.",
    ]
    if ventas_sin_cliente:
        adv.append(f"{ventas_sin_cliente} ventas del período sin nombre de cliente: no figuran en la lista.")
    if not datos_personales:
        adv.append("Acceso por token: se omiten teléfono y email.")
    return {
        "filtros": f.as_dict(),
        "kpis": {
            "clientes_unicos": total_clientes,
            "clientes_repiten": repiten,
            "pct_clientes_repiten": _pct(repiten, total_clientes),
            "clientes_una_sola_compra": una_sola,
            "ventas_sin_cliente": int(ventas_sin_cliente),
        },
        "clientes": lista,
        "advertencias": adv,
    }


# ─────────────────────────── CSV ───────────────────────────


def a_csv(filas: Iterable[dict]) -> str:
    """CSV UTF-8 con BOM (Excel lo abre bien). Decimales con punto."""
    filas = list(filas)
    buf = io.StringIO()
    buf.write("﻿")
    if not filas:
        return buf.getvalue()
    columnas: list[str] = []
    for fila in filas:
        for k in fila:
            if k not in columnas:
                columnas.append(k)
    w = csv.DictWriter(buf, fieldnames=columnas, extrasaction="ignore", lineterminator="\r\n")
    w.writeheader()
    for fila in filas:
        w.writerow({k: ("" if v is None else v) for k, v in fila.items()})
    return buf.getvalue()
