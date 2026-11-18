# Módulo de reportes (`/admin/reportes`)

Reportes de negocio del **canal minorista** para el admin (pensados para el
celular) y para un asistente de IA con token de solo lectura. Los dos caminos
usan los mismos endpoints y el mismo servicio (`backend/app/services/reportes.py`).

## Reglas de cálculo

| Tema | Regla |
|---|---|
| Qué es una venta | Toda fila de `sales` con `origen` = `admin` (cargada en el admin) o `vendedor` (bot de WhatsApp) y sin `pedido_mayorista_id`. **No incluye web ni mayorista.** |
| Canceladas / eliminadas | En minorista no hay estado "cancelada": anular una venta la borra de la base, así que nunca aparece. |
| Filtro `estado` | `todas` (default) · `entregadas` (`sales.delivered`) · `cobradas` (`sales.paid`). |
| Fecha | `sales.created_at` (UTC) llevada a America/Argentina/Buenos_Aires. `desde` y `hasta` son inclusivos. Default: últimos 30 días. |
| Facturación | Suma de `sale_items.total_price`. |
| Costo unitario | Promedio ponderado del precio de compra de los lotes (`stock_purchases`) del producto con fecha ≤ fecha de la venta. Se ignoran los lotes a $0. Si no hay lotes previos se usa `products.original_price` (solo ARS) y se avisa que es costo actual. Si no hay ninguno, el ítem queda **sin costo**. |
| Margen | Por producto: `null` si algún ítem no tiene costo. En agregados (resumen, vendedoras): se calcula sobre los ítems con costo, con `facturacion_con_costo` como base y `items_sin_costo` como contador. |
| Clientes | Se identifican por `customer_name` normalizado (minúsculas, sin espacios extra). "% que repite" = clientes del período con 2 o más compras minoristas en toda su historia hasta `hasta`. |
| Stock total | `SUM(quantity - out_quantity)` de `stock_purchases`. |
| Stock por depósito | El reparto manual del admin (`product_color_stock` si el producto tiene colores con depósito; si no, `product_deposit_stock`). La diferencia con el total figura como depósito **"Sin asignar"**. |
| Valuación del stock | Stock × costo promedio de lo que queda de cada lote (si no hay lotes, costo actual con aviso). |
| Días sin venta (stock parado) | Desde la última venta del producto **en cualquier canal**. Si nunca se vendió, desde la primera compra. |
| Cobranza de lo vendido | % cobrado de las ventas del período. Por ítem: si la venta es en cuotas, la parte proporcional de lo cobrado; si no, el ítem si está pagado. Las ventas recientes todavía no tuvieron tiempo de cobrarse, así que el período actual siempre se ve peor que el anterior. |
| Cobrado en el período | Plata que entró por **fecha de cobro** (ítems pagados y cuotas pagadas), sin importar cuándo fue la venta. |
| Fechas de cobro y entrega | `sale_items.paid_at` / `delivered_at` y `sale_installments.paid_at`. Una venta queda entregada/cobrada cuando se entrega/cobra su último producto o cuota. Las fechas son **reales solo desde el corte**: el momento en que se cargó `estado_historial` (se toma de la base) o `REPORTS_FECHAS_REALES_DESDE`. Antes de eso la migración completó valores aproximados. Cada cálculo de días usa solo las fechas que necesita y entra si todas son reales: una venta de agosto cobrada en octubre sí cuenta en venta → cobro. |
| Cobro antes de la entrega | No debería pasar: si aparece, no entra en el promedio entrega → cobro y se avisa. |
| Por cobrar / por entregar | Foto a hoy (todas las fechas, con los filtros de canal, vendedora y depósito). Por cobrar = entregado − cobrado; por entregar = total − entregado. Antigüedad desde la primera entrega o desde la venta. |
| Montos | `Decimal` en todo el cálculo. En JSON viajan como **string decimal exacto** (`"8469400.00"`), nunca float. |

Cada respuesta trae `advertencias` (lista de strings) con los huecos de datos del
período: ítems sin costo, ítems valuados a costo actual, ventas sin cliente, etc.

## Endpoints

Base: `https://<backend>/api/v1/admin/reportes`

Filtros comunes: `desde`, `hasta` (AAAA-MM-DD), `canal` (`admin` | `vendedor`),
`deposito_id`, `vendedora_id`, `estado`, `agrupar` (`dia` | `semana` | `mes`),
`formato` (`json` | `csv`).

| Endpoint | Parámetros propios |
|---|---|
| `GET /resumen` | — |
| `GET /ventas` | — |
| `GET /productos` | `orden` (`facturacion`, `unidades`, `margen`, `margen_pct`, `costo`, `stock`, `dias_cobertura`, `ultima_venta`), `direccion`, `top`, `bottom` |
| `GET /stock-inmovilizado` | `deposito_id`, `dias_min` (default 60). No usa fechas: es una foto del stock actual. |
| `GET /vendedoras` | — (`base_comisionable` siempre `null` por ahora) |
| `GET /clientes` | `top` (default 50), `orden`, `solo_una_compra` |
| `GET /ciclo` | — Tiempos venta → entrega → cobro, cobranza, plata que entró, por cobrar / por entregar por antigüedad, por vendedora y detalle de pendientes (el CSV exporta el detalle). |

Ejemplos (token por query param, como lo usa el asistente):

```
GET /api/v1/admin/reportes/resumen?desde=2026-10-01&hasta=2026-10-31&token=<TOKEN>
GET /api/v1/admin/reportes/ventas?desde=2026-08-01&hasta=2026-10-31&agrupar=semana&token=<TOKEN>
GET /api/v1/admin/reportes/productos?desde=2026-10-01&hasta=2026-10-31&orden=margen&top=10&token=<TOKEN>
GET /api/v1/admin/reportes/productos?desde=2026-10-01&hasta=2026-10-31&orden=unidades&bottom=20&token=<TOKEN>
GET /api/v1/admin/reportes/stock-inmovilizado?dias_min=90&token=<TOKEN>
GET /api/v1/admin/reportes/vendedoras?desde=2026-10-01&hasta=2026-10-31&canal=admin&token=<TOKEN>
GET /api/v1/admin/reportes/clientes?desde=2026-01-01&hasta=2026-10-31&solo_una_compra=true&token=<TOKEN>
GET /api/v1/admin/reportes/resumen?desde=2026-10-01&hasta=2026-10-31&formato=csv&token=<TOKEN>
GET /api/v1/admin/reportes/ciclo?desde=2026-10-01&hasta=2026-10-31&token=<TOKEN>
```

## Autenticación

1. **Admin:** header `X-Admin-API-Key` con una key de rol `superadmin` (el mismo
   login del admin). `product_editor` → 403.
2. **Token de solo lectura:** `REPORTS_API_TOKEN`, por header `X-Reports-Token`
   o por query param `token`.
   - Se compara en tiempo constante (`secrets.compare_digest`).
   - Solo lo acepta `/admin/reportes/*`. En cualquier otra ruta no vale nada (401).
   - Si la variable está vacía, este camino queda deshabilitado.
   - Rate limit: 60 consultas/min por IP (`REPORTS_RATE_LIMIT_PER_MIN`), en memoria.
   - Por este camino `/clientes` no devuelve teléfono ni email. Nunca se
     devuelve la dirección completa, solo la localidad.
   - El valor del token se reemplaza por `***` en los logs de acceso de uvicorn.

## Variables de entorno (Railway, servicio backend)

| Variable | Obligatoria | Uso |
|---|---|---|
| `REPORTS_API_TOKEN` | No | Token para el asistente. Generar con `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Vacía = sin acceso por token. |
| `REPORTS_DATABASE_URL` | No (recomendada) | Conexión con el usuario `reportes_ro`. Vacía = conexión principal en transacción `READ ONLY`. |
| `REPORTS_RATE_LIMIT_PER_MIN` | No | Default 60. |
| `REPORTS_STATEMENT_TIMEOUT_MS` | No | Default 15000 (15 s). |
| `REPORTS_FECHAS_REALES_DESDE` | No | AAAA-MM-DD desde la que las fechas de cobro/entrega son reales. Vacía = se toma de la base. |

Todas las consultas de reportes corren en una transacción `READ ONLY` con
`statement_timeout` (las dos se aplican con o sin `REPORTS_DATABASE_URL`).

## Usuario de solo lectura

Ajustá `railway` si la base tiene otro nombre (en Railway suele llamarse así).

```sql
CREATE ROLE reportes_ro WITH LOGIN PASSWORD '<generar>';
GRANT CONNECT ON DATABASE railway TO reportes_ro;
GRANT USAGE ON SCHEMA public TO reportes_ro;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO reportes_ro;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO reportes_ro;
ALTER ROLE reportes_ro SET default_transaction_read_only = on;
```

Después: `REPORTS_DATABASE_URL=postgresql://reportes_ro:<password>@<host>:<port>/railway`.

> `ALTER DEFAULT PRIVILEGES` solo cubre las tablas que cree **el usuario que
> ejecuta ese comando**. Corrélo con el mismo usuario que corre las migraciones
> (`postgres` en Railway), o las tablas nuevas no van a ser legibles por `reportes_ro`.

## Índice propuesto (no aplicado)

`backend/alembic/propuestas/111_indices_reportes.py` agrega `ix_sales_origen_created_at`
en `sales (origen, created_at)`. Está fuera de `alembic/versions` a propósito,
porque el build corre `alembic upgrade head`. Para aplicarlo, moverlo a
`alembic/versions/` y deployar.

## Diagnóstico de huecos de datos

Consulta de solo lectura para correr en producción (por ejemplo con `reportes_ro`):

```sql
SELECT
  (SELECT COUNT(*) FROM products p WHERE p.enabled
     AND NOT EXISTS (SELECT 1 FROM stock_purchases sp WHERE sp.product_id = p.id AND sp.unit_price > 0)
     AND NOT (COALESCE(p.original_price, 0) > 0 AND COALESCE(p.original_currency, 'ARS') = 'ARS'))
    AS productos_habilitados_sin_costo,
  (SELECT COUNT(*) FROM products WHERE COALESCE(original_currency, 'ARS') <> 'ARS') AS productos_en_otra_moneda,
  (SELECT COUNT(*) FROM sale_items si JOIN sales s ON s.id = si.sale_id
     WHERE s.origen IN ('admin','vendedor') AND si.product_id IS NULL) AS items_manuales_minorista,
  (SELECT COUNT(*) FROM sales WHERE origen IN ('admin','vendedor')
     AND NULLIF(btrim(customer_name), '') IS NULL) AS ventas_minoristas_sin_cliente,
  (SELECT COUNT(*) FROM stock_purchases WHERE product_id IS NULL) AS lotes_sin_producto,
  (SELECT COUNT(*) FROM stock_purchases WHERE deposit_id IS NULL) AS lotes_sin_deposito,
  (SELECT COUNT(*) FROM stock_purchases WHERE unit_price <= 0) AS lotes_a_costo_cero,
  (SELECT COUNT(*) FROM pedidos_mayoristas pm
     WHERE pm.estado <> 'cancelado'
       AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.pedido_mayorista_id = pm.id)) AS pedidos_mayoristas_sin_venta;
```

## Bugs detectados (no corregidos en este módulo)

1. **Borrar una venta entregada no devuelve el stock al depósito.**
   `SalesService._restore_deposit_stock` no hace nada si no existe la fila en
   `product_deposit_stock`. Tampoco se devuelve si `sale_items.deposit_id` es
   NULL (la vendedora no tenía depósito al entregar). Con `force=true`, los
   errores de devolución se descartan en silencio. El total en `stock_purchases`
   sí se devuelve.
2. **Las entregas de pedidos mayoristas** descuentan solo `stock_purchases`, nunca
   `product_deposit_stock` ni `product_color_stock`. Por eso el reparto por
   depósito se desfasa del total.
3. **El FIFO de `stock_purchases` ignora el depósito del lote:** el stock por lote y
   depósito no refleja de dónde salió la mercadería.
4. **`/admin/stats/monthly-summary`** agrupa por mes sobre `created_at` en UTC: las
   ventas entre las 21 y las 24 h de Argentina del último día del mes caen en el
   mes siguiente.
5. **`ADMIN_API_KEY` se compara con `==`** (no en tiempo constante) en `core/security.py`.
6. **Error de hidratación de React (#418) en todas las páginas del admin:** el
   estado inicial de `useAuth` lee `sessionStorage`/`localStorage` durante el
   render, así que el HTML del servidor no coincide con el del cliente.
7. **Fechas de cobro de ventas cargadas entre el 18/09 y el 29/09/2026:** si en ese
   momento la venta estaba cobrada solo en parte, la migración 108 les puso como
   fecha de cobro de cada ítem la fecha de la venta (no la real). Es una ventana
   chica y queda dentro de las fechas "reales" del reporte.
