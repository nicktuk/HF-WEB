# Relevamiento de acciones admin — HF WEB

> Generado: 2026-05-19  
> Objetivo: base para definir permisos por rol/usuario

---

## Productos — CRUD

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/productos` | Listar productos | `GET /api/v1/admin/products` | Ve habilitados e inhabilitados. Filtros: fuente, categoría, badges, rango de precio, en stock. Paginación 1–100. Incluye stock summary y precios de mercado. |
| `/admin/productos/[id]` | Ver producto | `GET /api/v1/admin/products/{id}` | Retorna imágenes (primaria primero), color stock, precios pendientes, stats de mercado. |
| `/admin/productos` | Crear desde fuente (scraping) | `POST /api/v1/admin/products` | Requiere `source_website_id` + `product_slug`. Scraping automático. Se crea deshabilitado. Rate limit: 30/min. |
| `/admin/productos` | Crear manual | `POST /api/v1/admin/products/manual` | Sin fuente. Se marca como "Producto Manual". Rate limit: 30/min. |
| `/admin/productos/[id]` | Actualizar producto | `PATCH /api/v1/admin/products/{id}` | Campos editables: `enabled`, `markup_percentage`, `custom_name`, `custom_price`, `category_id`, `display_order`, `is_featured`, `is_immediate_delivery`, `is_check_stock`, `is_best_seller`, `is_on_demand`, `is_published`, `installments_3`, `custom_installment_price`, `video_url`, `stock_low_threshold`. |
| `/admin/productos` | Eliminar producto | `DELETE /api/v1/admin/products/{id}` | Eliminación física. |

---

## Productos — Imágenes y multimedia

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/productos` | Subir imágenes | `POST /api/v1/admin/upload/images` | Acepta JPEG, PNG, WebP, GIF. Máx 10 MB/archivo. Retorna URLs `/uploads/{filename}`. Rate limit: 60/min. |
| `/admin/productos/[id]` | Subir video | `POST /api/v1/admin/upload/video` | Acepta MP4, WebM, OGG. Máx 100 MB. Se asigna a `product.video_url`. Rate limit: 20/min. |
| `/admin/configuracion` | Sincronizar uploads desde prod | `GET /api/v1/admin/upload/sync-from-prod` | Descarga desde `PROD_BACKEND_URL` los archivos referenciados en BD pero ausentes localmente. Útil en staging. |
| `/admin/productos/[id]` | Ver color stock | `GET /api/v1/admin/products/{id}/color-stock` | Lista `{color, quantity}` desde `ProductColorStock`. |
| `/admin/productos/[id]` | Actualizar color stock | `PUT /api/v1/admin/products/{id}/color-stock` | Reemplaza todos los registros de color stock del producto. |

---

## Productos — Precios y markup

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/productos` | Markup masivo | `POST /api/v1/admin/products/bulk-markup` | Solo habilitados si `only_enabled=true`. Precio final = `original_price × (1 + markup/100)`. Filtra por fuente si se indica `source_website_id`. |
| `/admin/productos` | Markup mayorista masivo | `POST /api/v1/admin/products/bulk-wholesale-markup` | Igual que markup pero actualiza `wholesale_markup_percentage`. Por defecto aplica a todos (no solo habilitados). |
| `/admin/productos` | Ver precios pendientes | `GET /api/v1/admin/products/pending-prices` | Productos donde `pending_original_price ≠ original_price`. Incluye fecha de detección. |
| `/admin/productos` | Aprobar precios pendientes | `POST /api/v1/admin/products/pending-prices/approve` | Mueve `pending_original_price` → `original_price`. Limpia `pending_price_detected_at`. |
| `/admin/productos` | Rechazar precios pendientes | `POST /api/v1/admin/products/pending-prices/reject` | Descarta `pending_original_price` sin tocar `original_price`. |

---

## Productos — Badges y flags

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/productos` | Agregar badge | `POST /api/v1/admin/products/add-badge` | Badges: `is_featured`, `is_immediate_delivery`, `is_best_seller`, `is_published`. Aplica a lista de `product_ids`. |
| `/admin/productos` | Remover badge | `POST /api/v1/admin/products/remove-badge` | Si `product_ids` vacío: aplica a TODOS los habilitados. |
| `/admin/productos` | Marcar "Nuevo" por fecha de scraping | `POST /api/v1/admin/products/mark-new-by-date` | Filtra por `last_scraped_at = scrape_date`. Establece `is_featured = true`. |
| `/admin/productos` | Calcular best sellers automáticamente | `POST /api/v1/admin/products/calculate-best-sellers` | Parámetro `threshold` (default 5). Marca `is_best_seller = true` si `total_sold ≥ threshold`. |

---

## Productos — Acciones bulk

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/productos` | Habilitar seleccionados | `POST /api/v1/admin/products/bulk-action` `action=enable` | Establece `enabled = true`. |
| `/admin/productos` | Deshabilitar seleccionados | `POST /api/v1/admin/products/bulk-action` `action=disable` | Establece `enabled = false`. |
| `/admin/productos` | Eliminar seleccionados | `POST /api/v1/admin/products/bulk-action` `action=delete` | Eliminación física de cada uno. |
| `/admin/productos` | Cambiar categoría de seleccionados | `POST /api/v1/admin/products/change-category-selected` | Busca `Category` por nombre. Actualiza `category_id` en todos. |
| `/admin/productos` | Cambiar subcategoría de seleccionados | `POST /api/v1/admin/products/change-subcategory-selected` | Actualiza `subcategory` (string libre). |
| `/admin/productos` | Deshabilitar por proveedor | `POST /api/v1/admin/products/disable-by-supplier` | Deshabilita todos los productos que tienen compras del supplier indicado. Solo deshabilita, no elimina. |
| `/admin/productos` | Activar todos los inactivos | `POST /api/v1/admin/products/activate-all-inactive` | Habilita todos los `enabled=false` y aplica `markup_percentage`. |
| `/admin/productos` | Activar seleccionados | `POST /api/v1/admin/products/activate-selected` | Solo activa si `original_price > 0`. Salta los sin precio. Puede asignar categoría y subcategoría. Retorna `{activated, skipped}`. |
| `/admin/productos` | Deshabilitar seleccionados | `POST /api/v1/admin/products/disable-selected` | Establece `enabled = false` en todos. |

---

## Productos — Scraping

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/productos/[id]` | Rescrapear producto | `POST /api/v1/admin/products/{id}/rescrape` | Requiere `source_website_id` + `source_url` válidos. Actualiza nombre, precio, descripción e imágenes. Incrementa `scrape_error_count` si falla. Rate limit: 10/min. |
| `/admin/productos` | Scrapear todos de fuente (sync) | `POST /api/v1/admin/source-websites/{id}/scrape-all` | Obtiene slugs del catálogo fuente. Crea nuevos (deshabilitados), opcionalmente actualiza existentes. Puede tardar minutos. Rate limit: 2/hora. |
| `/admin/productos` | Iniciar job de scraping (async) | `POST /api/v1/admin/source-websites/{id}/scrape-job` | Crea job con ID único. Falla si ya hay un job activo para esa fuente. Retorna `job_id` para polling. |
| `/admin/productos` | Ver estado de job | `GET /api/v1/admin/scrape-jobs/{job_id}` | Retorna `{status, processed, new, updated, errors}`. Status: `running`, `completed`, `failed`. |
| `/admin/productos` | Cancelar job | `DELETE /api/v1/admin/scrape-jobs/{job_id}` | Solo cancela si `status = running`. Conserva los productos ya procesados. |
| `/admin/productos` | Listar todos los jobs | `GET /api/v1/admin/scrape-jobs` | Histórico completo (activos y terminados). |
| `/admin/productos` | Deshabilitar todos de fuente | `POST /api/v1/admin/source-websites/{id}/disable-all` | Establece `enabled = false` para todos los de esa fuente. |
| `/admin/productos` | Eliminar todos de fuente | `DELETE /api/v1/admin/source-websites/{id}/products` | **Eliminación física y permanente** de todos los productos de la fuente. Requiere confirmación. |
| `/admin/productos` | Marcar "Consultar stock" para todos de fuente | `POST /api/v1/admin/source-websites/{id}/check-stock-all` | Establece `is_check_stock=true`, `is_featured=false`, `is_immediate_delivery=false`. |

---

## Categorías — CRUD

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/categorias` | Listar categorías | `GET /api/v1/categories?include_inactive=true` | Admin ve activas e inactivas. Incluye `product_count`, `enabled_product_count` y config de carousel. |
| `/admin/categorias` | Crear categoría | `POST /api/v1/categories` | Nombre único (case-sensitive). Color default `#6b7280`. |
| `/admin/categorias` | Actualizar categoría | `PATCH /api/v1/categories/{id}` | Si cambia nombre: valida unicidad. No afecta los productos asignados. |
| `/admin/categorias` | Eliminar categoría | `DELETE /api/v1/categories/{id}` | Pone `category_id = NULL` en todos sus productos. Eliminación física de la categoría. |

---

## Categorías — Mapeo de fuentes

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/categorias` | Ver categorías sin mapear | `GET /api/v1/categories/unmapped-sources` | Lista `source_category` únicos sin mapeo, ordenados por cantidad de productos DESC. |
| `/admin/categorias` | Ver productos de categoría origen | `GET /api/v1/categories/source-products` | Parámetro `source_name` (exacto). Retorna hasta 200 productos con estado de mapeo. |
| `/admin/categorias` | Listar mapeos | `GET /api/v1/categories/mappings` | Retorna `{source_name, source_key, category_id, category_name, created_at}`. |
| `/admin/categorias` | Crear/actualizar mapeo | `POST /api/v1/categories/mappings` | Si `apply_existing=true`: cambia categoría de todos los productos con esa `source_category`. `source_key` normalizado (lowercase). |
| `/admin/categorias` | Eliminar mapeo | `DELETE /api/v1/categories/mappings/{id}` | Eliminación física. No afecta productos ya categorizados. |

---

## Secciones

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/secciones` | Listar secciones | `GET /api/v1/sections` | Admin ve activas e inactivas. Incluye productos resueltos según criterio. |
| `/admin/secciones` | Crear sección | `POST /api/v1/sections` | `criteria_type`: `manual`, `featured`, `immediate_delivery`, `best_seller`, `category`. Si `manual`: productos se agregan por separado. `max_products` limita resultado. |
| `/admin/secciones` | Actualizar sección | `PUT /api/v1/sections/{id}` | Mismos campos que crear. |
| `/admin/secciones` | Eliminar sección | `DELETE /api/v1/sections/{id}` | Elimina también todos los `SectionProduct` asociados. |
| `/admin/secciones` | Agregar producto a sección manual | `POST /api/v1/sections/{id}/products` | Solo válido si `criteria_type = manual`. Valida que no haya duplicados. |
| `/admin/secciones` | Remover producto de sección | `DELETE /api/v1/sections/{id}/products/{product_id}` | Eliminación de `SectionProduct`. |

---

## Ventas

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/ventas` | Listar ventas | `GET /api/v1/admin/sales` | Búsqueda por cliente o producto. Paginación (default 50, máx 200). |
| `/admin/ventas/[id]` | Ver venta | `GET /api/v1/admin/sales/{id}` | Incluye ítems, pagos, cuotas con estado. |
| `/admin/ventas` | Crear venta | `POST /api/v1/admin/sales` | Ítems pueden ser de producto o descripción manual. `delivered=true` descuenta stock. Soporta cuotas si se pasa `installments`. |
| `/admin/ventas/[id]` | Actualizar venta | `PATCH /api/v1/admin/sales/{id}` | `force=true` ignora errores de stock. Cambiar `delivered` revierte o descuenta stock. |
| `/admin/ventas` | Marcar ítem entregado/no entregado | `PATCH /api/v1/admin/sales/{id}` | `delivered=true` deduce stock. Si se revierte, restaura stock. Requiere `force=true` si no hay stock suficiente. |
| `/admin/ventas` | Marcar ítem pagado/no pagado | `PATCH /api/v1/admin/sales/{id}` | Auto-asigna primer método de pago "negocio" si no hay uno. Afecta `Sale.paid_amount`. |
| `/admin/ventas` | Establecer método de pago | `PATCH /api/v1/admin/sales/{id}` | Actualiza `payment_method`. Incide en el dashboard de balance. |
| `/admin/ventas` | Actualizar cuota individual | `PATCH /api/v1/admin/sales/{id}/installments/{inst_id}` | Puede cambiar `paid` (bool) o `amount`. Afecta totales de la venta. |
| `/admin/ventas` | Eliminar venta | `DELETE /api/v1/admin/sales/{id}` | Revierte stock de ítems entregados. Sin `force=true` falla si el revert genera stock negativo. |
| `/admin/ventas` | Reconciliar stock entregado | `POST /api/v1/admin/sales/reconcile-delivered-stock` | Recalcula todo el stock deducido desde cero a partir de las entregas registradas. Útil para corregir inconsistencias. |

---

## Pedidos

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/pedidos` | Listar pedidos | `GET /api/v1/admin/orders` | Filtros: `status` (all/active/closed), `search` por cliente. |
| `/admin/pedidos/[id]` | Ver pedido | `GET /api/v1/admin/orders/{id}` | Incluye ítems, adjuntos y datos de cierre. |
| `/admin/pedidos` | Crear pedido | `POST /api/v1/admin/orders` | No deduce stock. Status inicial: `active`. Soporta adjuntos. |
| `/admin/pedidos/[id]` | Actualizar pedido | `PATCH /api/v1/admin/orders/{id}` | Solo si `status = active`. |
| `/admin/pedidos` | Cerrar pedido (con venta) | `POST /api/v1/admin/orders/{id}/close` | Vincula a `sale_id`. Status → `completed_sale`. |
| `/admin/pedidos` | Cerrar pedido (sin venta) | `POST /api/v1/admin/orders/{id}/close` | Requiere `no_sale_reason`. Status → `completed_no_sale`. |
| `/admin/pedidos` | Reabrir pedido | `POST /api/v1/admin/orders/{id}/reopen` | Status → `active`. |
| `/admin/pedidos` | Eliminar pedido | `DELETE /api/v1/admin/orders/{id}` | Solo si está cerrado. Eliminación física. |
| `/admin/pedidos` | Stats de pedidos | `GET /api/v1/admin/orders/stats` | Retorna `{active_count, completed_count, by_seller}`. |
| `/admin/pedidos/[id]` | Subir adjunto | `POST /api/v1/admin/orders/{id}/attachments` | Mismo proceso que imágenes de producto. Crea `OrderAttachment`. |
| `/admin/pedidos/[id]` | Eliminar adjunto | `DELETE /api/v1/admin/orders/{id}/attachments/{att_id}` | Eliminación física de `OrderAttachment`. |

---

## Stock y compras

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/stock/compras` | Preview CSV de stock | `POST /api/v1/admin/stock/preview` | Valida estructura CSV sin guardar. Columnas: `product_id, description, code, quantity, unit_price, supplier, notes`. |
| `/admin/stock/compras` | Importar CSV de stock | `POST /api/v1/admin/stock/import` | Crea `Purchase` por supplier + fecha y `StockPurchase` ítems. Retorna `{purchase_id, created, skipped, errors}`. |
| `/admin/stock/resumen` | Resumen de stock | `POST /api/v1/admin/stock/summary` | Body: `{product_ids}`. Retorna `{stock_qty, reserved_qty, original_price, reserved_sale_value}` por producto. |
| `/admin/stock/compras` | Listar compras sin asignar | `GET /api/v1/admin/stock/purchases?unmatched=true` | Filtra `StockPurchase` donde `product_id = null`. |
| `/admin/stock/compras` | Asignar producto a compra | `PATCH /api/v1/admin/stock/purchases/{id}` | Body: `{product_id}`. Sin validación de duplicados. |
| `/admin/stock/compras` | Crear compra manual | `POST /api/v1/admin/purchases` | Crea `Purchase` + `StockPurchase` ítems. Los ítems pueden tener `product_id` ya asignado. |
| `/admin/stock/compras` | Listar compras | `GET /api/v1/admin/purchases` | Filtros: `supplier`, `date_from`, `date_to`, `product_id`, `payer`. Paginación. |
| `/admin/stock/compras` | Ver lista de proveedores | `GET /api/v1/admin/purchases/suppliers` | Retorna strings únicos de suppliers para autocomplete. |
| `/admin/stock/compras` | Ver detalle de compra | `GET /api/v1/admin/purchases/{id}` | Incluye ítems + pagos + nombres de productos. |
| `/admin/stock/compras` | Agregar pago a compra | `POST /api/v1/admin/purchases/{id}/payments` | Body: `[{payer, amount, payment_method}]`. Actualiza `Purchase.total_paid`. |
| `/admin/stock/compras` | Eliminar pago | `DELETE /api/v1/admin/purchases/{id}/payments/{pay_id}` | Recalcula `total_paid` automáticamente. |

---

## Gastos

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/gastos` | Listar gastos | `GET /api/v1/expenses` | Filtros: `date_from`, `date_to`. Ordena por fecha DESC. Incluye total. |
| `/admin/gastos` | Crear gasto | `POST /api/v1/expenses` | Campos: `date`, `description`, `payment_method`, `amount`, `notes`. |
| `/admin/gastos` | Actualizar gasto | `PUT /api/v1/expenses/{id}` | Permite cambiar cualquier campo. |
| `/admin/gastos` | Eliminar gasto | `DELETE /api/v1/expenses/{id}` | Eliminación física. |

---

## Estadísticas y finanzas

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/stats` | Balance de cuentas | `GET /api/v1/admin/stats/account-balance` | Cuentas "negocio": cobrado − pagado − gastos. Cuentas personales: egresos por pagador (Facu/Heber). |
| `/admin/stats` | Stock por categoría | `GET /api/v1/admin/stats/stock-by-category` | Retorna `{stock_qty, valuation}` por categoría. |
| `/admin/stats` | Stats financieros | `GET /api/v1/admin/stats/financials` | Agregados de ventas, compras, gastos, márgenes por período. |
| `/admin/stats` | Resumen mensual | `GET /api/v1/admin/stats/monthly-summary` | Parámetro `year`. 12 meses con: compras, ventas, gastos, balance. |
| `/admin/stats` | Compras por pagador | `GET /api/v1/admin/stats/purchases-by-payer` | Retorna `{payer, total}` por pagador único. |
| `/admin/clientes-ranking` | Ranking de clientes | `GET /api/v1/admin/stats/customer-ranking` | Agrupa por cliente: `{purchase_count, product_count, total_amount}`. Ordena por monto DESC. |
| `/admin/analytics` | Stats por fuente y categoría | `GET /api/v1/admin/stats/by-source-category` | Matriz source × categoría con conteos de productos. |
| `/admin/analytics` | Stats por rango de precio | `GET /api/v1/admin/stats/by-price-range` | Rangos: 0-5k, 5k-20k, 20k-80k, 80k+. |
| `/admin/analytics` | Analítica pública | `GET /api/v1/admin/stats/public-analytics` | Parámetro `days` (1-90). Categorías visitadas, productos vistos, búsquedas. |

---

## Configuración

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/configuracion` | Ver config de IA | `GET /api/v1/settings/ai` | Retorna keys enmascaradas (`****...{últimos 6 chars}`). |
| `/admin/configuracion` | Actualizar config de IA | `PUT /api/v1/settings/ai` | Si la key viene enmascarada: no la actualiza. Soporta: `provider`, `anthropic_key`, `openai_key`, `brave_key`, `batch_concurrency`, `prompt_extra`. |
| `/admin/configuracion` | Ver config de catálogo | `GET /api/v1/settings/catalog` | Retorna flags de visualización del frontend público. |
| `/admin/configuracion` | Actualizar config de catálogo | `PUT /api/v1/settings/catalog` | Controla: `show_by_sections`, `group_by_category`, `stock_low_threshold`, `carousel_style`, `popup_enabled`, `popup_interval`, `popup_slides`, `mobile_two_columns`, entre otros. |
| `/admin/configuracion` | Ver métodos de pago | `GET /api/v1/settings/payment-methods` | Retorna `[{name, is_business, is_card, is_mercadopago}]`. `is_business` determina si afecta el balance del negocio. |
| `/admin/configuracion` | Actualizar métodos de pago | `PUT /api/v1/settings/payment-methods` | Reemplaza la lista completa. Filtra vacíos. |
| `/admin/configuracion` | Ver config MercadoPago | `GET /api/v1/settings/mp` | Retorna `public_key` y `access_token` enmascarados. |
| `/admin/configuracion` | Actualizar config MercadoPago | `PUT /api/v1/settings/mp` | Mismo sistema de enmascaramiento que IA. |
| `/admin/configuracion` | Ver textos de badges | `GET /api/v1/admin/settings/badges` | Retorna `{key, label, default, current, is_custom}` por cada badge. |
| `/admin/configuracion` | Actualizar texto de badge | `PUT /api/v1/admin/settings/badges/{key}` | Máx 50 caracteres. |
| `/admin/configuracion` | Resetear texto de badge | `DELETE /api/v1/admin/settings/badges/{key}` | Vuelve al texto por defecto. |

---

## IA — Descripciones automáticas

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/ai-descripciones` | Generar descripciones (batch) | `POST /api/v1/ai/generate` | Modos: `single`, `category`, `pending`, `all`, `selected`. Action: `description`, `images`, `both`. Ejecuta en background. Retorna `job_id`. |
| `/admin/ai-descripciones` | Ver estado de job | `GET /api/v1/ai/job/{job_id}` | Retorna `{status, total, processed, success, failed, progress_pct, errors (últimos 20), results (últimos 30)}`. |
| `/admin/ai-descripciones` | Cancelar job | `POST /api/v1/ai/job/{job_id}/cancel` | Solo cancela si `status = running`. |
| `/admin/productos/[id]` | Generar descripción individual (sync) | `POST /api/v1/ai/generate/{product_id}` | Flags: `use_search`, `use_vision`, `use_source_refetch`, `use_image_search`. Retorna texto inmediatamente. Máx 2000 caracteres. |
| `/admin/ai-descripciones` | Buscar imágenes para producto | `POST /api/v1/ai/search-images/{product_id}` | Usa Brave Image Search. Agrega URLs encontradas a `ProductImage`. Requiere plan Pro de Brave. |
| `/admin/ai-descripciones` | Stats de cobertura | `GET /api/v1/ai/stats` | Retorna `{total_enabled, with_description, without_description}` global y por categoría. |

---

## WhatsApp

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/productos` | Filtrar productos para mensaje | `POST /api/v1/admin/whatsapp/filter-products` | Filtra por badges, categoría, subcategoría, límite. |
| `/admin/productos` | Generar mensajes individuales | `POST /api/v1/admin/whatsapp/generate-messages` | Templates: `default`, `promo`, `nuevos`, `mas_vendidos`, `custom`. Retorna un mensaje por producto. |
| `/admin/productos` | Generar mensaje bulk | `POST /api/v1/admin/whatsapp/generate-bulk-message` | Un mensaje combinado con lista de productos. |
| `/admin/productos` | Generar imagen con IA | `POST /api/v1/admin/whatsapp/generate-image` | Usa GPT-4o image generation. Input: `prompt` + imagen de referencia. Retorna base64. Requiere `OPENAI_API_KEY`. |
| `/admin/productos` | Post manual (producto no en catálogo) | `POST /api/v1/admin/whatsapp/manual-post` | Genera descripción WhatsApp con IA. Soporta web search (Brave). Retorna texto máx 4 líneas con emojis. |

---

## Precios de mercado

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/productos/[id]` | Ver precios de mercado | `GET /api/v1/admin/products/{id}/market-prices` | Retorna `{avg_price, min_price, max_price, sample_count, last_updated}`. Null si no hay datos. |
| `/admin/productos/[id]` | Refrescar precios de mercado | `POST /api/v1/admin/products/{id}/market-prices/refresh` | Busca en MercadoLibre. Rate limit: 5/min. |
| `/admin/productos/[id]` | Análisis de competitividad | `GET /api/v1/admin/products/{id}/price-comparison` | Retorna `{your_price, market_avg, competitiveness ("competitive"\|"high"\|"low"), recommendation}`. |
| `/admin/comparador` | Comparador de precios por fuentes | `GET /api/v1/admin/price-comparator` | Busca keyword en múltiples fuentes. Retorna precio y disponibilidad agrupados por fuente. |

---

## Exportación

| Página | Acción | Endpoint | Reglas de negocio |
|--------|--------|----------|-------------------|
| `/admin/productos` | Exportar PDF catálogo | `GET /api/v1/admin/products/export/pdf` | Formato `catalog` (con imágenes) o `list` (tabla). Solo productos habilitados. |
| `/admin/productos` | Exportar PDF mayorista | `POST /api/v1/admin/products/export/wholesale` | Body: `{product_ids}`. Usa `wholesale_markup_percentage` para los precios. |
