# Import Scorer — Guía de uso

## Visión del proyecto

**Radar de productos virales + herramienta de precio puesto en Argentina.**

Dos radares independientes:
- **Radar Argentina** — qué está demandando la gente acá ahora
- **Radar USA** — qué podés traer hoy con buen margen + qué va a ser viral en AR en ~6 meses

La lógica de anticipación: lo que pega en USA hoy suele llegar a Argentina 6 meses después. El radar USA es tanto operativo (comprar ahora) como predictivo (prepararse para después).

---

## Orden de configuración (primera vez)

### 1. Configuración global
`Import Scorer → Config`

Parámetros base del sistema:
- **Costo flete USD/kg** — costo de traer 1 kg desde USA
- **Sales tax FL** — impuesto Florida (ej: `0.07` = 7%)
- **Margen mínimo verde / amarillo** — umbrales del semáforo (ej: verde = 2.5×, amarillo = 1.8×)
- **Peso máximo envío** — límite del knapsack (ej: 23 kg)
- **Capital máximo envío** — límite de capital por carrito (ej: USD 1500)

---

### 2. Retailers (tiendas USA)
`Import Scorer → Retailers → +`

Scrapers implementados:

| Nombre   | Slug       | Método              | Requiere              |
|----------|------------|---------------------|-----------------------|
| Walmart  | `walmart`  | Scraping HTML       | Proxy si se bloquea   |
| Target   | `target`   | RedSky API pública  | Proxy si se bloquea   |
| Best Buy | `bestbuy`  | API oficial         | `BESTBUY_API_KEY`     |

El **slug** conecta el retailer con el scraper — tiene que coincidir exactamente.

**Best Buy API key:** gratuita en `developers.bestbuy.com`. Una vez obtenida, agregarla como variable de entorno `BESTBUY_API_KEY` en Railway.

**Proxy:** si Walmart o Target se bloquean desde Railway, agregar la variable `SCRAPER_PROXY_URL` con formato `https://scraperapi:KEY@proxy.scraperapi.com:8001`. Activa el proxy en todos los scrapers automáticamente.

---

### 3. Rubros (categorías a monitorear)
`Import Scorer → Rubros → +`

Este es el paso clave. Sin rubros configurados no hay radar ni scraping.

**Tab General:**
- Nombre del rubro (ej: "Celulares")
- Prioridad: número mayor = se procesa primero

**Tab ML (MercadoLibre Argentina):**
- `ml_category_id`: ID numérico de categoría (formato `MLA####`)
- `ml_listado_url`: alternativa — pegá la URL de la categoría de ML directamente (ej: `https://www.mercadolibre.com.ar/c/celulares-y-telefonos`). El scraper resuelve el ID automáticamente.
- `top_n_scraping`: cuántos productos traer (50–200)

**Tab USA:**
- Marcá los retailers activos para este rubro (Walmart, Target, Best Buy)
- `palabras_busqueda_usa`: términos de búsqueda en cada tienda **y también para Google Trends** (ej: "iphone 15", "samsung galaxy s24"). El primer keyword se usa para el radar.

**Tab Scoring:**
- Márgenes mínimos propios del rubro (sobreescriben los globales si están definidos)

---

## Radar
`Import Scorer → Radar`

Muestra la tendencia de cada rubro en Argentina y USA basada en Google Trends (últimos 3 meses).

**Cómo leer el radar:**
- Barras azules = tendencia en Argentina
- Barras violetas = tendencia en USA
- **Oportunidad** (badge ámbar): está subiendo en USA pero no en Argentina → anticipación de viral

**Tab Oportunidades:** filtra solo los rubros con señal de anticipación activa.

**Botón "Actualizar radar":** dispara la consulta a Google Trends en background para todos los rubros. Puede tardar 1-2 minutos. También podés actualizar rubro por rubro con el ícono de refresh en cada card.

> **Nota:** Google Trends puede bloquearse desde IPs de servidores cloud. Si el radar no actualiza, activar `SCRAPER_PROXY_URL` en Railway.

---

## Scraping de productos
`Import Scorer → Analytics → "Scrapear ahora"`

O desde el listado de Rubros, el botón ▶ al lado de cada rubro.

El scraping hace:
1. ML → trae los top N productos de la categoría con su precio ARS y vendidos
2. Walmart / Target / Best Buy → busca los keywords del rubro y trae precios USD

Cuando termina aparece en "Últimos scrapings" con productos actualizados, errores y duración.

**Si aparece 0 actualizados con 0 errores:** el rubro no tiene `ml_category_id` ni `ml_listado_url` configurados.
**Si aparece 0 actualizados con errores:** el scraper está siendo bloqueado → activar proxy.

---

## Productos
`Import Scorer → Productos`

Cada producto tiene un semáforo calculado como `ratio = precio_ARS / (precio_USD × dólar_MEP)`:
- Verde: ratio > margen mínimo verde → conviene importar
- Amarillo: ratio entre umbrales → analizar
- Rojo: no conviene

Filtros por rubro, semáforo y búsqueda de texto. Clic en un producto expande ofertas USA, link a ML y datos de detalle.

---

## Flujo de un envío

### Crear carrito
`Import Scorer → Carritos → +`

Nombre + parámetros opcionales (peso máx, capital máx). Arranca en estado **borrador**.

### Agregar productos
Desde el detalle del carrito → "Agregar producto". Buscás de la lista scrapeada, elegís cantidad.

### Cotizar
Toma el dólar MEP del momento y calcula costos. El carrito pasa a **cotizado** con snapshot de la cotización.

### Optimizar ⚡
Algoritmo knapsack: sugiere qué llevar para maximizar margen respetando peso y capital máximos.

### Generar Lista de Caza
Para ítems en modo outlet → genera la lista para compra física en Miami.

---

## Lista de caza
`Import Scorer → Listas de caza`

- Descargar PDF para llevar al outlet
- Cambiar estado: pendiente → en_progreso → completada
- Agregar notas internas

---

## Estados del carrito

```
borrador → cotizado → comprado → en_transito → recibido
               ↓
           cancelado
```

---

## Variables de entorno en Railway

| Variable             | Descripción                                      | Requerida     |
|----------------------|--------------------------------------------------|---------------|
| `BESTBUY_API_KEY`    | API key de Best Buy (gratis en developers.bestbuy.com) | Para Best Buy |
| `SCRAPER_PROXY_URL`  | URL del proxy (ej: ScraperAPI). Activa proxy en todos los scrapers | Si hay bloqueos |

---

## Problemas comunes

**"Scrapeo pero no aparecen productos"**
1. ¿El rubro tiene `ml_category_id` o `ml_listado_url`? → sin eso no scrapea ML
2. ¿El ID de categoría es válido? → verificar en el browser: `https://api.mercadolibre.com/sites/MLA/search?category=TU_ID`
3. ¿Los logs de Railway muestran 403? → activar `SCRAPER_PROXY_URL`

**"El radar no actualiza / muestra sin_datos"**
1. ¿El rubro tiene `palabras_busqueda_usa`? → el primer keyword se usa para Google Trends
2. ¿Hay error en los logs? → probablemente bloqueo de Google → activar proxy

**"Best Buy no scrapeó nada"**
- Verificar que `BESTBUY_API_KEY` esté configurada en Railway
- El scraper logea "BESTBUY_API_KEY no configurada" si falta
