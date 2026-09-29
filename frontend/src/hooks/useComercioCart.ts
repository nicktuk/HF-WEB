'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { calcularPrecioPorDescuento, type TramoDescuento } from '@/lib/precios-comercio'

export interface CartItem {
  producto_id: number
  nombre: string
  imagen_url: string | null
  /** Precio mayorista del producto, sin descuento por cantidad. */
  precio_comercio: number
  cantidad: number
  unidades_por_bulto?: number | null
  cantidad_minima?: number | null
  /** Precio de venta sugerido (minorista) — solo informativo. */
  precio_venta?: number | null
}

export interface PricingConfig {
  redondeo: number
  tramos_descuento: TramoDescuento[]
}

interface CartStore {
  items: CartItem[]
  pricingConfig: PricingConfig | null
  setPricingConfig: (cfg: PricingConfig) => void
  add: (item: Omit<CartItem, 'cantidad'>, cantidad: number) => void
  update: (producto_id: number, cantidad: number) => void
  remove: (producto_id: number) => void
  clear: () => void
  /** Precio unitario vigente del ítem — precio mayorista con el descuento por cantidad aplicado. */
  precioUnitario: (item: CartItem) => number
  total: () => number
  itemCount: () => number
}

export const useComercioCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      pricingConfig: null,

      setPricingConfig: (cfg) => set({ pricingConfig: cfg }),

      add: (item, cantidad) => set(state => {
        const exists = state.items.find(i => i.producto_id === item.producto_id)
        if (exists) {
          return {
            items: state.items.map(i =>
              i.producto_id === item.producto_id
                ? { ...i, cantidad: i.cantidad + cantidad }
                : i
            ),
          }
        }
        return { items: [...state.items, { ...item, cantidad }] }
      }),

      update: (producto_id, cantidad) => set(state => ({
        items: cantidad <= 0
          ? state.items.filter(i => i.producto_id !== producto_id)
          : state.items.map(i => i.producto_id === producto_id ? { ...i, cantidad } : i),
      })),

      remove: (producto_id) => set(state => ({
        items: state.items.filter(i => i.producto_id !== producto_id),
      })),

      clear: () => set({ items: [] }),

      precioUnitario: (item) => {
        const cfg = get().pricingConfig
        if (!cfg) return item.precio_comercio
        return calcularPrecioPorDescuento(item.precio_comercio, item.cantidad, cfg.tramos_descuento, cfg.redondeo)
      },

      total: () => get().items.reduce((sum, i) => sum + get().precioUnitario(i) * i.cantidad, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.cantidad, 0),
    }),
    {
      name: 'hefa_carrito_comercio',
      partialize: (state) => ({ items: state.items }),
    }
  )
)
