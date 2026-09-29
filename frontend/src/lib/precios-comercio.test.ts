import { describe, it, expect } from 'vitest'
import { calcularDescuentoPorCantidad, calcularPrecioPorDescuento } from './precios-comercio'

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

  it('sin descuento aplicable devuelve el precio mayorista', () => {
    expect(calcularPrecioPorDescuento(10000, 0, tramos, 0)).toBe(10000)
  })
})
