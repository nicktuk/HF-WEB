'use client'

import { calcularDescuentoPorCantidad, calcularPrecioPorDescuento, type TramoDescuento } from '@/lib/precios-comercio'
import { getTramoScaleColor, type ComercioTheme } from '@/lib/comercio-theme'

interface Props {
  precioVenta: number
  cantidad: number
  tramos: TramoDescuento[]
  redondeo: number
  theme: ComercioTheme
  compact?: boolean
}

export function SavingsBar({ precioVenta, cantidad, tramos, redondeo, theme, compact }: Props) {
  if (tramos.length === 0) return null

  const ordenados = [...tramos].sort((a, b) => a.cantidad_minima - b.cantidad_minima)
  const maxDescuento = ordenados[ordenados.length - 1].descuento_porcentaje
  const descuentoActual = calcularDescuentoPorCantidad(ordenados, cantidad)
  const progreso = maxDescuento > 0 ? Math.min(1, Math.max(0, descuentoActual / maxDescuento)) : 0

  const precioActual = calcularPrecioPorDescuento(precioVenta, cantidad, ordenados, redondeo)
  const ahorro = Math.max(0, (precioVenta - precioActual) * cantidad)

  const proximoTramo = ordenados.find(t => t.cantidad_minima > cantidad)

  const fill = getTramoScaleColor(progreso)

  return (
    <div className={compact ? 'mt-0.5' : 'mt-1'}>
      <div className="flex items-center justify-between mb-1">
        <span className={compact ? 'text-[10px] font-bold' : 'text-xs font-bold'} style={{ color: fill }}>
          {ahorro > 0 ? `Vas ahorrando $${Math.round(ahorro).toLocaleString('es-AR')}` : 'Comprá más para empezar a ahorrar'}
        </span>
        <span className={compact ? 'text-[9px]' : 'text-[11px]'} style={{ color: theme.textFaint }}>
          {Math.round(descuentoActual)}% / {Math.round(maxDescuento)}%
        </span>
      </div>
      <div
        className="w-full rounded-full overflow-hidden"
        style={{ height: compact ? 5 : 7, backgroundColor: theme.inputBorder }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.max(4, progreso * 100)}%`, backgroundColor: fill }}
        />
      </div>
      {proximoTramo && (
        <p className={compact ? 'text-[9px] mt-1' : 'text-[11px] mt-1.5'} style={{ color: theme.textFaint }}>
          Comprá {proximoTramo.cantidad_minima - cantidad} más y llegás a {proximoTramo.descuento_porcentaje}%
        </p>
      )}
    </div>
  )
}
