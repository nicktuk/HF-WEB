# Import Scorer — Guía de uso

## Orden de configuración (primera vez)

### 1. Configuración global
`Import Scorer → Config`

Establecé los parámetros base antes de arrancar:
- **Costo flete USD/kg** — cuánto cuesta traer 1 kg de USA
- **Sales tax FL** — impuesto de Florida (ej: `0.07` = 7%)
- **Margen mínimo verde / amarillo** — umbrales del semáforo (ej: verde = 2.5×, amarillo = 1.8×)
- **Peso máximo envío** — límite del knapsack (ej: 23 kg)
- **Capital máximo envío** — límite de capital por carrito (ej: USD 1500)

---

### 2. Retailers (tiendas USA)
`Import Scorer → Retailers → +`

Creá uno por tienda. Los únicos con scraper implementado son:

| Nombre  | Slug      | Notas            |
|---------|-----------|------------------|
| Walmart | `walmart` | Parsea la web    |
| Target  | `target`  | Usa RedSky API   |

El **slug** es lo que conecta el retailer con el scraper. Tiene que coincidir exactamente.

---

### 3. Rubros (categorías a monitorear)
`Import Scorer → Rubros → +`

Este es el paso clave. Sin rubros bien configurados el scraper no hace nada.

**Tab General:**
- Nombre del rubro (ej: "Celulares")
- Prioridad: número mayor = se scrapea primero

**Tab ML (MercadoLibre):**
- `ml_category_id`: el ID numérico de categoría MLA (formato `MLA####`). Si no lo sabés, dejalo vacío y usá `ml_listado_url`.
- `ml_listado_url`: podés pegar directamente la URL de la categoría de ML, por ejemplo `https://www.mercadolibre.com.ar/c/celulares-y-telefonos`. El scraper resuelve el ID automáticamente siguiendo el redirect.
- `top_n_scraping`: cuántos productos traer (50–200)

**Tab USA:**
- Marcá los retailers activos (Walmart, Target)
- `palabras_busqueda_usa`: términos para buscar en cada tienda (ej: "iphone 15", "samsung galaxy")

**Tab Scoring:**
- Márgenes mínimos propios del rubro (sobreescriben los globales si están definidos)

---

### 4. Hacer el primer scraping
`Import Scorer → Analytics → "Scrapear ahora"`

O desde el listado de Rubros, el botón ▶ al lado de cada rubro.

El scraping corre en background. Cuando termina aparece en "Últimos scrapings" con:
- cuántos productos se actualizaron
- cuántos errores hubo
- duración

**Si aparece 0 actualizados con 0 errores:** el rubro no tiene `ml_category_id` configurado.
**Si aparece 0 actualizados con errores:** revisá los logs del backend en Railway.

---

### 5. Ver productos
`Import Scorer → Productos`

Cada producto tiene un semáforo:
- Verde: margen > umbral verde → conviene importar
- Amarillo: margen entre umbrales → analizar
- Rojo: no conviene

Podés filtrar por rubro, semáforo, o buscar por nombre.
Clic en un producto expande las ofertas USA y el link a ML.

---

## Flujo de un envío

### 6. Crear carrito
`Import Scorer → Carritos → +`

Nombre + parámetros opcionales (peso máx, capital máx). El carrito arranca en estado **borrador**.

### 7. Agregar productos
En el detalle del carrito → "Agregar producto". Buscás de la lista de productos ya scrapeados, elegís cantidad.

### 8. Cotizar
Botón **Cotizar** → toma el dólar MEP del momento y calcula costos. El carrito pasa a estado **cotizado** con snapshot de la cotización.

### 9. Optimizar con Knapsack
Botón **Optimizar** → el algoritmo reordena/sugiere qué llevar para maximizar el margen respetando el peso y capital máximos.

### 10. Generar Lista de Caza
Si el carrito tiene ítems en modo outlet → botón **Lista de caza** → genera la lista para compra física en Miami.

---

## Lista de caza
`Import Scorer → Listas de caza`

Muestra las listas generadas. Podés:
- Descargar el PDF para llevar al outlet
- Cambiar el estado (pendiente → en_progreso → completada)
- Agregar notas internas

---

## Estados del carrito

```
borrador → cotizado → comprado → en_transito → recibido
               ↓
           cancelado
```

---

## Problema más común

**"Scrapeo pero no aparecen productos"**
1. ¿El rubro tiene `ml_category_id`? → sin eso no scrapea ML
2. ¿El ID de categoría es válido? → probalo en el browser: `https://api.mercadolibre.com/sites/MLA/search?category=TU_ID`
3. ¿Los logs de Railway muestran error HTTP? → puede ser rate limiting de ML
