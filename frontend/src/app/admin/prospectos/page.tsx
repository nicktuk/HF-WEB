'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApiKey } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

function apiFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { 'X-Admin-API-Key': apiKey, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
}

interface Prospecto {
  id: number
  comercio_nombre: string
  whatsapp: string | null
  direccion: string | null
  estado: string
  fecha_proximo_contacto: string | null
  notas: string | null
  comercio_id: number | null
  vendedor_id: number
  vendedor_nombre: string | null
}

interface Vendedor {
  id: number
  nombre: string
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  interesado: { label: 'Interesado', color: 'bg-blue-100 text-blue-700' },
  lo_pienso: { label: 'Lo piensa', color: 'bg-amber-100 text-amber-700' },
  no_va: { label: 'No va', color: 'bg-zinc-100 text-zinc-500' },
  convertido: { label: 'Convertido', color: 'bg-emerald-100 text-emerald-700' },
}

export default function ProspectosAdminPage() {
  const apiKey = useApiKey() ?? ''
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroVendedor, setFiltroVendedor] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')

  const fetchData = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroVendedor) params.set('vendedor_id', filtroVendedor)
    if (filtroEstado) params.set('estado', filtroEstado)
    const res = await apiFetch(`/admin/prospectos?${params.toString()}`, apiKey)
    if (res.ok) setProspectos(await res.json())
    setLoading(false)
  }, [apiKey, filtroVendedor, filtroEstado])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (!apiKey) return
    apiFetch('/admin/vendedores', apiKey).then(async res => {
      if (res.ok) setVendedores(await res.json())
    })
  }, [apiKey])

  const porEstado = (estado: string) => prospectos.filter(p => p.estado === estado).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Prospectos</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Comercios que los vendedores van visitando y cargando en su cartera de prospección, todavía sin convertir en clientes.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 max-w-2xl">
        {Object.entries(ESTADOS).map(([key, info]) => (
          <div key={key} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500">{info.label}</p>
            <p className="text-xl font-bold text-gray-900">{porEstado(key)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <select
          value={filtroVendedor}
          onChange={e => setFiltroVendedor(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los vendedores</option>
          {vendedores.map(v => (
            <option key={v.id} value={v.id}>{v.nombre}</option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([key, info]) => (
            <option key={key} value={key}>{info.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : prospectos.length === 0 ? (
        <p className="text-sm text-gray-500">No hay prospectos para este filtro.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Comercio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">WhatsApp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dirección</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Próximo contacto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {prospectos.map(p => {
                const estadoInfo = ESTADOS[p.estado] ?? { label: p.estado, color: 'bg-gray-100 text-gray-700' }
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.comercio_nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{p.vendedor_nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.whatsapp ? (
                        <a
                          href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          {p.whatsapp}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{p.direccion ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                        {estadoInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {p.fecha_proximo_contacto
                        ? new Date(p.fecha_proximo_contacto).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={p.notas ?? ''}>
                      {p.notas ?? '—'}
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
