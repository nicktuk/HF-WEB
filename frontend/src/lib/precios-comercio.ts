export interface ConfigComercio {
  descuento_porcentaje: number
  redondeo: number // 0 = sin redondeo; >0 = ceil al múltiplo indicado
}

export function calcularPrecioComercio(
  precioCosto: number,
  override: number | null,
  config: ConfigComercio,
): number {
  if (override !== null) {
    return override
  }

  const precio = precioCosto * (1 + config.descuento_porcentaje / 100)

  if (config.redondeo > 0) {
    return Math.ceil(precio / config.redondeo) * config.redondeo
  }

  return precio
}

export interface TramoDescuento {
  cantidad_minima: number
  descuento_porcentaje: number
}

/**
 * Descuento % aplicable a `cantidad` unidades según la matriz de tramos.
 * Espeja la lógica de descuento_para_cantidad en el backend (comercio_catalog.py):
 * usa el tramo de mayor cantidad_minima que la cantidad alcance; si no alcanza
 * ni el tramo más bajo, no hay descuento.
 */
export function calcularDescuentoPorCantidad(tramos: TramoDescuento[], cantidad: number): number {
  let aplicable = 0
  for (const t of [...tramos].sort((a, b) => a.cantidad_minima - b.cantidad_minima)) {
    if (t.cantidad_minima <= cantidad) {
      aplicable = t.descuento_porcentaje
    } else {
      break
    }
  }
  return aplicable
}

/**
 * Precio unitario en modo "descuento": parte del precio minorista y descuenta
 * el % que corresponda a `cantidad` según la matriz de tramos. Uso exclusivo
 * para mostrar el precio en vivo en la UI (ficha de producto / carrito) — la
 * confirmación real del pedido siempre recalcula el precio en el servidor.
 */
export function calcularPrecioPorDescuento(
  precioVenta: number,
  cantidad: number,
  tramos: TramoDescuento[],
  redondeo: number,
): number {
  const descuento = calcularDescuentoPorCantidad(tramos, cantidad)
  const precio = precioVenta * (1 - descuento / 100)
  return redondeo > 0 ? Math.ceil(precio / redondeo) * redondeo : precio
}
