'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApiKey } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

const ESTADOS = {
  pendiente:  { label: 'Pendiente',   color: 'bg-yellow-100 text-yellow-700' },
  activo:     { label: 'Activo',      color: 'bg-green-100 text-green-700' },
  rechazado:  { label: 'Rechazado',   color: 'bg-red-100 text-red-700' },
  suspendido: { label: 'Suspendido',  color: 'bg-gray-100 text-gray-700' },
} as const

type Estado = keyof typeof ESTADOS

interface Mayorista {
  id: number
  nombre: string
  apellido: string
  usuario: string
  celular: string | null
  email: string | null
  nombre_local: string
  ubicacion_local: string
  estado: Estado
  vendedor_id: number | null
  vendedor_nombre: string | null
  activado_at: string | null
  created_at: string | null
}

interface Vendedor {
  id: number
  nombre: string
  celular_wa: string
  activo: boolean
}

function apiFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { 'X-Admin-API-Key': apiKey, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
}

export default function MayoristasAdminPage() {
  const apiKey = useApiKey() ?? ''
  const [mayoristas, setMayoristas] = useState<Mayorista[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroSearch, setFiltroSearch] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroEstado) params.set('estado', filtroEstado)
    if (filtroSearch) params.set('search', filtroSearch)
    const [resM, resV] = await Promise.all([
      apiFetch(`/admin/mayoristas?${params}`, apiKey),
      apiFetch('/admin/vendedores?activo=true', apiKey),
    ])
    if (resM.ok) {
      const d = await resM.json()
      setMayoristas(d.items)
      setTotal(d.total)
    }
    if (resV.ok) setVendedores(await resV.json())
    setLoading(false)
  }, [apiKey, filtroEstado, filtroSearch])

  useEffect(() => { fetchData() }, [fetchData])

  async function cambiarEstado(id: number, estado: string) {
    setUpdatingId(id)
    await apiFetch(`/admin/mayoristas/${id}/estado`, apiKey, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    })
    await fetchData()
    setUpdatingId(null)
  }

  async function asignarVendedor(id: number, vendedor_id: string) {
    setUpdatingId(id)
    await apiFetch(`/admin/mayoristas/${id}/vendedor`, apiKey, {
      method: 'PATCH',
      body: JSON.stringify({ vendedor_id: vendedor_id ? parseInt(vendedor_id) : null }),
    })
    await fetchData()
    setUpdatingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mayoristas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} cuentas registradas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Buscar por nombre, local, usuario..."
          value={filtroSearch}
          onChange={e => setFiltroSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
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

      {/* Tabla */}
      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : mayoristas.length === 0 ? (
        <p className="text-sm text-gray-500">No hay mayoristas que coincidan.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cuenta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Local</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Registro</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {mayoristas.map(m => {
                const estadoInfo = ESTADOS[m.estado] ?? { label: m.estado, color: 'bg-gray-100 text-gray-700' }
                const isUpdating = updatingId === m.id
                return (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{m.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.nombre} {m.apellido}</p>
                      <p className="text-xs text-gray-400">@{m.usuario} · {m.celular ?? m.email ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{m.nombre_local}</p>
                      <p className="text-xs text-gray-400">{m.ubicacion_local}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                        {estadoInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        disabled={isUpdating}
                        value={m.vendedor_id ?? ''}
                        onChange={e => asignarVendedor(m.id, e.target.value)}
                        className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
                      >
                        <option value="">Sin vendedor</option>
                        {vendedores.map(v => (
                          <option key={v.id} value={v.id}>{v.nombre}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        {m.estado !== 'activo' && (
                          <button
                            disabled={isUpdating}
                            onClick={() => cambiarEstado(m.id, 'activo')}
                            className="px-2 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                          >
                            Activar
                          </button>
                        )}
                        {m.estado !== 'rechazado' && (
                          <button
                            disabled={isUpdating}
                            onClick={() => cambiarEstado(m.id, 'rechazado')}
                            className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        )}
                        {m.estado === 'activo' && (
                          <button
                            disabled={isUpdating}
                            onClick={() => cambiarEstado(m.id, 'suspendido')}
                            className="px-2 py-1 rounded text-xs font-medium bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50"
                          >
                            Suspender
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
