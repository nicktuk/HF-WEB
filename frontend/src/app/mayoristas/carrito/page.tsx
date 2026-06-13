'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMayoristaCart } from '@/hooks/useMayoristaCart'

export default function CarritoPage() {
  const router = useRouter()
  const { items, update, remove, total, clear } = useMayoristaCart()
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalVal = total()

  async function handleConfirmar() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/mayoristas/pedidos', {
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
      router.push(`/mayoristas/pedido/${data.pedido_id}`)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-500 text-sm">Tu carrito está vacío.</p>
        <Link href="/mayoristas/catalogo" className="text-sm font-medium text-gray-900 underline">
          Ir al catálogo
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-800">Tu pedido</h1>
          <Link href="/mayoristas/catalogo" className="text-sm text-gray-500 hover:underline">
            ← Seguir comprando
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {items.map(item => (
            <div key={item.producto_id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{item.nombre}</p>
                <p className="text-xs text-gray-500">
                  ${item.precio_mayorista.toLocaleString('es-AR')} c/u
                </p>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => update(item.producto_id, item.cantidad - 1)}
                  className="w-7 h-7 border border-gray-300 rounded text-sm hover:bg-gray-50"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm">{item.cantidad}</span>
                <button
                  onClick={() => update(item.producto_id, item.cantidad + 1)}
                  className="w-7 h-7 border border-gray-300 rounded text-sm hover:bg-gray-50"
                >
                  +
                </button>
              </div>

              <p className="text-sm font-semibold text-gray-900 w-24 text-right">
                ${(item.precio_mayorista * item.cantidad).toLocaleString('es-AR')}
              </p>

              <button
                onClick={() => remove(item.producto_id)}
                className="text-gray-300 hover:text-red-400 text-lg leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          <textarea
            placeholder="Notas del pedido (opcional)"
            value={notas}
            onChange={e => setNotas(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300"
          />

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total</span>
            <span className="text-xl font-bold text-gray-900">
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
            className="w-full bg-gray-900 text-white rounded-lg py-3 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Confirmando...' : 'Confirmar pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
