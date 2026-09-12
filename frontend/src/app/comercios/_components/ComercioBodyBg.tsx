'use client'

import { useEffect } from 'react'

/**
 * El body del sitio es crema (globals.css, para el minorista). En /comercios
 * el fondo es navy — sin esto, el rebote de scroll en los bordes (o cualquier
 * franja que no cubran los divs de la página) deja ver el crema/blanco del
 * body en vez de continuar el navy.
 */
export function ComercioBodyBg() {
  useEffect(() => {
    const prevHtml = document.documentElement.style.backgroundColor
    const prevBody = document.body.style.backgroundColor
    document.documentElement.style.backgroundColor = '#0D1B2A'
    document.body.style.backgroundColor = '#0D1B2A'
    return () => {
      document.documentElement.style.backgroundColor = prevHtml
      document.body.style.backgroundColor = prevBody
    }
  }, [])

  return null
}
