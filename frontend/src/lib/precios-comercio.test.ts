import { describe, it, expect } from 'vitest'
import { calcularPrecioComercio } from './precios-comercio'

const cfg = (descuento: number, redondeo: number) => ({ descuento_porcentaje: descuento, redondeo })

describe('calcularPrecioComercio', () => {
  it('aplica descuento sin redondeo', () => {
    expect(calcularPrecioComercio(10000, null, cfg(25, 0))).toBe(7500)
  })

  it('con override devuelve el override sin aplicar descuento', () => {
    expect(calcularPrecioComercio(10000, 6000, cfg(25, 100))).toBe(6000)
  })

  it('override 0 es válido y no cae al descuento', () => {
    expect(calcularPrecioComercio(10000, 0, cfg(25, 100))).toBe(0)
  })

  it('redondeo a 100 con ceil: 7501 → 7600', () => {
    // 10001 * 0.75 = 7500.75 → ceil al 100 → 7600
    expect(calcularPrecioComercio(10001, null, cfg(25, 100))).toBe(7600)
  })

  it('redondeo a 100 exacto no sube: 7500 → 7500', () => {
    expect(calcularPrecioComercio(10000, null, cfg(25, 100))).toBe(7500)
  })

  it('redondeo 0 devuelve precio sin redondear', () => {
    expect(calcularPrecioComercio(10001, null, cfg(25, 0))).toBeCloseTo(7500.75)
  })

  it('descuento 0 devuelve el precio minorista (con redondeo)', () => {
    expect(calcularPrecioComercio(10000, null, cfg(0, 100))).toBe(10000)
  })

  it('descuento 0 sin redondeo devuelve precio exacto', () => {
    expect(calcularPrecioComercio(9999, null, cfg(0, 0))).toBe(9999)
  })
})
