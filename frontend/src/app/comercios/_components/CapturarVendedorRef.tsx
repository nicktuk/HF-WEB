'use client'

import { useEffect } from 'react'
import { capturarVendedorRef } from '@/lib/vendedor-ref'

/**
 * Componente invisible: persiste ?v=<vendedor_id> en cookie apenas se carga
 * la página, para que sobreviva hasta que el visitante complete la solicitud
 * de alta (posiblemente varias páginas después). No afecta el SSR/SEO de la
 * página que lo contiene — es un client component hijo, no la vuelve 'use client'.
 */
export function CapturarVendedorRef() {
  useEffect(() => {
    capturarVendedorRef()
  }, [])
  return null
}
