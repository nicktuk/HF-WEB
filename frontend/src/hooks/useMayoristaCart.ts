'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  producto_id: number
  nombre: string
  imagen_url: string | null
  precio_mayorista: number
  cantidad: number
}

interface CartStore {
  items: CartItem[]
  add: (item: Omit<CartItem, 'cantidad'>, cantidad: number) => void
  update: (producto_id: number, cantidad: number) => void
  remove: (producto_id: number) => void
  clear: () => void
  total: () => number
  itemCount: () => number
}

export const useMayoristaCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

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

      total: () => get().items.reduce((sum, i) => sum + i.precio_mayorista * i.cantidad, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.cantidad, 0),
    }),
    {
      name: 'hefa_carrito_mayorista',
    }
  )
)
