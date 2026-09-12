import { describe, it, expect } from 'vitest'
import { calcularPrecioComercio, calcularDescuentoPorCantidad, calcularPrecioPorDescuento } from './precios-comercio'

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

const tramos = [
  { cantidad_minima: 1, descuento_porcentaje: 10 },
  { cantidad_minima: 5, descuento_porcentaje: 15 },
  { cantidad_minima: 10, descuento_porcentaje: 20 },
]

describe('calcularDescuentoPorCantidad', () => {
  it('usa el tramo más alto que la cantidad alcance', () => {
    expect(calcularDescuentoPorCantidad(tramos, 1)).toBe(10)
    expect(calcularDescuentoPorCantidad(tramos, 4)).toBe(10)
    expect(calcularDescuentoPorCantidad(tramos, 5)).toBe(15)
    expect(calcularDescuentoPorCantidad(tramos, 9)).toBe(15)
    expect(calcularDescuentoPorCantidad(tramos, 10)).toBe(20)
    expect(calcularDescuentoPorCantidad(tramos, 100)).toBe(20)
  })

  it('sin alcanzar el tramo más bajo no hay descuento', () => {
    expect(calcularDescuentoPorCantidad(tramos, 0)).toBe(0)
  })

  it('sin tramos configurados no hay descuento', () => {
    expect(calcularDescuentoPorCantidad([], 50)).toBe(0)
  })

  it('funciona con tramos desordenados', () => {
    const desordenados = [tramos[2], tramos[0], tramos[1]]
    expect(calcularDescuentoPorCantidad(desordenados, 7)).toBe(15)
  })
})

describe('calcularPrecioPorDescuento', () => {
  it('aplica el descuento del tramo correspondiente', () => {
    expect(calcularPrecioPorDescuento(10000, 5, tramos, 0)).toBe(8500)
  })

  it('redondea hacia arriba al múltiplo indicado', () => {
    // 10001 * 0.85 = 8500.85 -> ceil al 100 -> 8600
    expect(calcularPrecioPorDescuento(10001, 5, tramos, 100)).toBe(8600)
  })

  it('sin descuento aplicable devuelve el precio minorista', () => {
    expect(calcularPrecioPorDescuento(10000, 0, tramos, 0)).toBe(10000)
  })
})
