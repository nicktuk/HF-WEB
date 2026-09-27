'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export interface VendedorInfo {
  id: number
  nombre: string
  usuario: string | null
  email: string | null
  celular_wa: string | null
  es_mayorista: boolean
  /** Link al catálogo de comercios; null si el vendedor no es mayorista. */
  link_personal: string | null
}

// Una sola consulta por carga de página, compartida entre el header y la pantalla.
let pedido: Promise<VendedorInfo | null> | null = null

function cargarInfo(): Promise<VendedorInfo | null> {
  if (!pedido) {
    pedido = fetch('/api/vendedores/info')
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
      .then(data => {
        if (!data) pedido = null // reintentar la próxima vez
        return data
      })
  }
  return pedido
}

/** Datos del vendedor logueado (null mientras carga o si falla). */
export function useVendedorInfo(): VendedorInfo | null {
  const [info, setInfo] = useState<VendedorInfo | null>(null)
  useEffect(() => {
    let vivo = true
    cargarInfo().then(data => { if (vivo) setInfo(data) })
    return () => { vivo = false }
  }, [])
  return info
}

/** Para pantallas sólo del canal mayorista: si el vendedor no es mayorista,
 *  lo manda a Mi día. Devuelve true cuando ya se confirmó que puede verla. */
export function useSoloMayorista(): boolean {
  const info = useVendedorInfo()
  const router = useRouter()
  useEffect(() => {
    if (info && !info.es_mayorista) router.replace('/vendedores/inicio')
  }, [info, router])
  return Boolean(info?.es_mayorista)
}
