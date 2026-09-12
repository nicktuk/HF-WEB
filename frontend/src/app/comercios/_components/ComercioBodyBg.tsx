'use client'

import { useEffect } from 'react'
import { useComercioTheme } from '@/hooks/useComercioTheme'

/**
 * El body del sitio es crema (globals.css, para el minorista). En /comercios
 * el fondo sigue el tema elegido — sin esto, el rebote de scroll en los
 * bordes (o cualquier franja que no cubran los divs de la página) deja ver
 * el crema del minorista en vez de continuar el fondo de comercios.
 */
export function ComercioBodyBg() {
  const mode = useComercioTheme(s => s.mode)

  useEffect(() => {
    const bg = mode === 'dark' ? '#0D1B2A' : '#FFFFFF'
    const prevHtml = document.documentElement.style.backgroundColor
    const prevBody = document.body.style.backgroundColor
    document.documentElement.style.backgroundColor = bg
    document.body.style.backgroundColor = bg
    return () => {
      document.documentElement.style.backgroundColor = prevHtml
      document.body.style.backgroundColor = prevBody
    }
  }, [mode])

  return null
}
