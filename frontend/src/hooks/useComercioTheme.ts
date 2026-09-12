'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ComercioThemeMode = 'dark' | 'light'

interface ComercioThemeStore {
  mode: ComercioThemeMode
  toggle: () => void
}

export const useComercioTheme = create<ComercioThemeStore>()(
  persist(
    (set) => ({
      mode: 'dark',
      toggle: () => set(state => ({ mode: state.mode === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'hefa_comercio_theme' }
  )
)
