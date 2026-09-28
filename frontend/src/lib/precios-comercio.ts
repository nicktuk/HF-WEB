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
 * Precio unitario para `cantidad` unidades: parte del precio mayorista propio
 * del producto y descuenta el % que corresponda según la matriz de tramos.
 * Espeja precio_comercio en el backend (comercio_catalog.py). Uso exclusivo
 * para mostrar el precio en vivo en la UI (ficha de producto / carrito) — la
 * confirmación real del pedido siempre recalcula el precio en el servidor.
 */
export function calcularPrecioPorDescuento(
  precioMayorista: number,
  cantidad: number,
  tramos: TramoDescuento[],
  redondeo: number,
): number {
  const descuento = calcularDescuentoPorCantidad(tramos, cantidad)
  const precio = precioMayorista * (1 - descuento / 100)
  return redondeo > 0 ? Math.ceil(precio / redondeo) * redondeo : precio
}
