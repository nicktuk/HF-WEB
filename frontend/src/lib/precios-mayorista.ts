export interface ConfigMayorista {
  descuento_porcentaje: number
  redondeo: number // 0 = sin redondeo; >0 = ceil al múltiplo indicado
}

export function calcularPrecioMayorista(
  precioMinorista: number,
  override: number | null,
  config: ConfigMayorista,
): number {
  if (override !== null) {
    return override
  }

  const precio = precioMinorista * (1 - config.descuento_porcentaje / 100)

  if (config.redondeo > 0) {
    return Math.ceil(precio / config.redondeo) * config.redondeo
  }

  return precio
}
