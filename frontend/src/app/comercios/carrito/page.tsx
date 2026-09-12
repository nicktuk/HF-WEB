'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useComercioCart } from '@/hooks/useComercioCart'

export default function CarritoPage() {
  const router = useRouter()
  const { items, update, remove, total, clear } = useComercioCart()
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalVal = total()

  async function handleConfirmar() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/comercios/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad })),
          notas,
        }),
      })
      const data = await res.json() as { pedido_id?: number; error?: string; detail?: string }
      if (!res.ok) {
        setError(data.detail ?? data.error ?? 'Error al confirmar el pedido.')
        return
      }
      clear()
      router.push(`/comercios/pedido/${data.pedido_id}`)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4" style={{ backgroundColor: '#f7f4ef' }}>
        <p className="text-zinc-500 text-sm">Tu carrito está vacío.</p>
        <Link href="/comercios/catalogo" className="text-sm font-semibold text-primary-600 hover:underline">
          Ir al catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-zinc-800">Tu pedido</h1>
          <Link href="/comercios/catalogo" className="text-sm text-zinc-500 hover:underline">
            ← Seguir comprando
          </Link>
        </div>

        <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm divide-y divide-zinc-100">
          {items.map(item => {
            const minima = item.cantidad_minima ?? null
            const alcanzaMinimo = !minima || item.cantidad >= minima
            return (
              <div key={item.producto_id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">{item.nombre}</p>
                  <p className="text-xs text-zinc-500">
                    ${item.precio_comercio.toLocaleString('es-AR')} c/u
                  </p>
                  {minima && (
                    <p className={`text-xs mt-0.5 ${alcanzaMinimo ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {alcanzaMinimo
                        ? '✓ Mínimo alcanzado'
                        : `⚠ Faltan ${minima - item.cantidad} u. (mínimo ${minima} u.)`}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => update(item.producto_id, item.cantidad - 1)}
                    className="w-7 h-7 border border-zinc-300 rounded-lg text-sm hover:bg-zinc-50"
                  >
                    −
                  </button>
                  <span className="w-8 text-center text-sm">{item.cantidad}</span>
                  <button
                    onClick={() => update(item.producto_id, item.cantidad + 1)}
                    className="w-7 h-7 border border-zinc-300 rounded-lg text-sm hover:bg-zinc-50"
                  >
                    +
                  </button>
                </div>

                <p className="text-sm font-semibold text-zinc-900 w-24 text-right">
                  ${(item.precio_comercio * item.cantidad).toLocaleString('es-AR')}
                </p>

                <button
                  onClick={() => remove(item.producto_id)}
                  className="text-zinc-300 hover:text-red-400 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>

        <div className="mt-4 space-y-4">
          <textarea
            placeholder="Notas del pedido (opcional)"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700">Total</span>
            <span className="text-xl font-bold text-zinc-900">
              ${totalVal.toLocaleString('es-AR')}
            </span>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleConfirmar}
            disabled={loading || items.length === 0}
            className="w-full bg-primary-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Confirmando...' : 'Confirmar pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
