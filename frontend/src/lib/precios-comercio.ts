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
