'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApiKey } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

const ESTADOS = {
  recibido:   { label: 'Recibido',        color: 'bg-blue-100 text-blue-700' },
  confirmado: { label: 'Confirmado',      color: 'bg-indigo-100 text-indigo-700' },
  preparando: { label: 'En preparación',  color: 'bg-yellow-100 text-yellow-700' },
  entregado:  { label: 'Entregado',       color: 'bg-green-100 text-green-700' },
  cancelado:  { label: 'Cancelado',       color: 'bg-red-100 text-red-700' },
} as const

type EstadoPedido = keyof typeof ESTADOS

interface Pedido {
  id: number
  comercio_id: number
  comercio_nombre: string | null
  comercio_local: string | null
  vendedor_nombre: string | null
  estado: EstadoPedido
  total: number
  notas: string | null
  created_at: string | null
}

interface PedidoDetalle extends Pedido {
  items: {
    id: number
    nombre_producto: string
    cantidad: number
    precio_unitario: number
    precio_original: number | null
    subtotal: number
  }[]
}

function apiFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { 'X-Admin-API-Key': apiKey, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
}

export default function PedidosComercioAdminPage() {
  const apiKey = useApiKey() ?? ''
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<PedidoDetalle | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroEstado) params.set('estado', filtroEstado)
    const res = await apiFetch(`/admin/comercios/pedidos?${params}&limit=100`, apiKey)
    if (res.ok) {
      const d = await res.json()
      setPedidos(d.items)
      setTotal(d.total)
    }
    setLoading(false)
  }, [apiKey, filtroEstado])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleDetalle(id: number) {
    if (expandedId === id) {
      setExpandedId(null)
      setDetalle(null)
      return
    }
    setExpandedId(id)
    const res = await apiFetch(`/admin/comercios/pedidos/${id}`, apiKey)
    if (res.ok) setDetalle(await res.json())
  }

  async function cambiarEstado(id: number, estado: string) {
    setUpdatingId(id)
    await apiFetch(`/admin/comercios/pedidos/${id}/estado`, apiKey, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    })
    await fetchData()
    if (expandedId === id) {
      const res = await apiFetch(`/admin/comercios/pedidos/${id}`, apiKey)
      if (res.ok) setDetalle(await res.json())
    }
    setUpdatingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos comercios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} pedidos</p>
        </div>
      </div>

      <div className="flex gap-3">
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <p className="text-sm text-gray-500">No hay pedidos que coincidan.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pedido</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Comercio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cambiar estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidos.map(p => {
                const estadoInfo = ESTADOS[p.estado] ?? { label: p.estado, color: 'bg-gray-100 text-gray-700' }
                const isUpdating = updatingId === p.id
                const isExpanded = expandedId === p.id
                return (
                  <>
                    <tr key={p.id} className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}>
                      <td className="px-4 py-3 text-gray-500 text-xs font-medium" onClick={() => toggleDetalle(p.id)}>
                        #{p.id}
                      </td>
                      <td className="px-4 py-3" onClick={() => toggleDetalle(p.id)}>
                        <p className="font-medium text-gray-900">{p.comercio_nombre ?? '—'}</p>
                        <p className="text-xs text-gray-400">{p.comercio_local ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs" onClick={() => toggleDetalle(p.id)}>
                        {p.vendedor_nombre ?? '—'}
                      </td>
                      <td className="px-4 py-3" onClick={() => toggleDetalle(p.id)}>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                          {estadoInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900" onClick={() => toggleDetalle(p.id)}>
                        ${p.total.toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400" onClick={() => toggleDetalle(p.id)}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          disabled={isUpdating}
                          value={p.estado}
                          onChange={e => cambiarEstado(p.id, e.target.value)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
                        >
                          {Object.entries(ESTADOS).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    {isExpanded && detalle && detalle.id === p.id && (
                      <tr key={`${p.id}-detail`}>
                        <td colSpan={7} className="px-4 pb-4 pt-0 bg-gray-50">
                          <div className="border border-gray-200 rounded-lg overflow-hidden mt-1">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="text-left px-3 py-2 text-gray-500">Producto</th>
                                  <th className="text-right px-3 py-2 text-gray-500">Cant.</th>
                                  <th className="text-right px-3 py-2 text-gray-500">P. unit.</th>
                                  <th className="text-right px-3 py-2 text-gray-500">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {detalle.items.map(i => (
                                  <tr key={i.id}>
                                    <td className="px-3 py-2 text-gray-800">{i.nombre_producto}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{i.cantidad}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">${i.precio_unitario.toLocaleString('es-AR')}</td>
                                    <td className="px-3 py-2 text-right font-medium text-gray-900">${i.subtotal.toLocaleString('es-AR')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {detalle.notas && (
                              <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                                <span className="font-medium">Notas:</span> {detalle.notas}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
