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

interface ComisionRow {
  id: number
  canal: 'mayorista' | 'minorista'
  vendedor_id: number
  vendedor_nombre: string | null
  pedido_id: number | null
  sale_id: number | null
  cliente_nombre: string | null
  base: number
  tasa: number
  monto: number
  estado: string
}

interface VentaPendiente {
  sale_id: number
  cliente_nombre: string | null
  total: number
  vendedor_id: number | null
  vendedor_nombre: string | null
}

const CANAL_LABEL: Record<string, string> = { mayorista: 'Mayorista', minorista: 'Minorista' }
const CANAL_COLOR: Record<string, string> = {
  mayorista: 'bg-indigo-100 text-indigo-700',
  minorista: 'bg-teal-100 text-teal-700',
}

export default function ComisionesAdminPage() {
  const apiKey = useApiKey() ?? ''
  const [comisiones, setComisiones] = useState<ComisionRow[]>([])
  const [pendientes, setPendientes] = useState<VentaPendiente[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCanal, setFiltroCanal] = useState<'' | 'mayorista' | 'minorista'>('')
  const [filtroEstado, setFiltroEstado] = useState<'' | 'pendiente' | 'liquidada'>('')
  const [editando, setEditando] = useState<number | null>(null)
  const [editModo, setEditModo] = useState<'monto' | 'tasa'>('monto')
  const [montoInput, setMontoInput] = useState('')
  const [tasaInput, setTasaInput] = useState('')
  const [generando, setGenerando] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroCanal) params.set('canal', filtroCanal)
    if (filtroEstado) params.set('estado', filtroEstado)
    const [comisionesRes, pendientesRes] = await Promise.all([
      apiFetch(`/admin/comisiones?${params.toString()}`, apiKey),
      apiFetch('/admin/ventas-minoristas/pendientes-comision', apiKey),
    ])
    if (comisionesRes.ok) setComisiones(await comisionesRes.json())
    if (pendientesRes.ok) setPendientes(await pendientesRes.json())
    setLoading(false)
  }, [apiKey, filtroCanal, filtroEstado])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleEstado(c: ComisionRow) {
    const nuevoEstado = c.estado === 'liquidada' ? 'pendiente' : 'liquidada'
    await apiFetch(`/admin/comisiones/${c.id}`, apiKey, {
      method: 'PATCH',
      body: JSON.stringify({ estado: nuevoEstado }),
    })
    await fetchData()
  }

  function startEditMonto(c: ComisionRow) {
    setEditando(c.id)
    setEditModo('monto')
    setMontoInput(String(c.monto))
  }

  function startEditTasa(c: ComisionRow) {
    setEditando(c.id)
    setEditModo('tasa')
    setTasaInput((c.tasa * 100).toFixed(2))
  }

  async function guardarEdicion(c: ComisionRow) {
    if (editModo === 'monto') {
      const monto = parseFloat(montoInput)
      if (!isNaN(monto)) {
        await apiFetch(`/admin/comisiones/${c.id}`, apiKey, {
          method: 'PATCH',
          body: JSON.stringify({ monto }),
        })
        await fetchData()
      }
    } else {
      const porcentaje = parseFloat(tasaInput)
      if (!isNaN(porcentaje)) {
        await apiFetch(`/admin/comisiones/${c.id}`, apiKey, {
          method: 'PATCH',
          body: JSON.stringify({ tasa: porcentaje / 100 }),
        })
        await fetchData()
      }
    }
    setEditando(null)
  }

  async function generarComision(sale_id: number) {
    setGenerando(sale_id)
    await apiFetch(`/admin/ventas-minoristas/${sale_id}/generar-comision`, apiKey, { method: 'POST' })
    await fetchData()
    setGenerando(null)
  }

  const totalPendiente = comisiones.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.monto, 0)
  const totalLiquidado = comisiones.filter(c => c.estado === 'liquidada').reduce((s, c) => s + c.monto, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comisiones</h1>
        <p className="text-sm text-gray-500 mt-0.5">Mayorista y minorista, editables caso por caso.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Pendiente</p>
          <p className="text-xl font-bold text-amber-600">${totalPendiente.toLocaleString('es-AR')}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Liquidado</p>
          <p className="text-xl font-bold text-emerald-600">${totalLiquidado.toLocaleString('es-AR')}</p>
        </div>
      </div>

      {pendientes.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="text-sm font-semibold text-amber-900 mb-2">
            Ventas minoristas pagadas sin comisión generada ({pendientes.length})
          </h2>
          <div className="space-y-2">
            {pendientes.map(v => (
              <div key={v.sale_id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{v.cliente_nombre ?? `Venta #${v.sale_id}`}</span>
                  <span className="text-gray-400"> · ${v.total.toLocaleString('es-AR')} · </span>
                  <span className="text-gray-500">{v.vendedor_nombre ?? 'sin vendedor'}</span>
                </div>
                <button
                  onClick={() => generarComision(v.sale_id)}
                  disabled={generando === v.sale_id}
                  className="text-xs font-medium bg-amber-600 text-white rounded-lg px-3 py-1.5 hover:bg-amber-700 disabled:opacity-50"
                >
                  {generando === v.sale_id ? 'Generando...' : 'Generar comisión'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <select
          value={filtroCanal}
          onChange={e => setFiltroCanal(e.target.value as typeof filtroCanal)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los canales</option>
          <option value="mayorista">Mayorista</option>
          <option value="minorista">Minorista</option>
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="liquidada">Liquidada</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : comisiones.length === 0 ? (
        <p className="text-sm text-gray-500">No hay comisiones para este filtro.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Canal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Base</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comisiones.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${CANAL_COLOR[c.canal]}`}>
                      {CANAL_LABEL[c.canal]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{c.vendedor_nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{c.cliente_nombre ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">${c.base.toLocaleString('es-AR')}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {editando === c.id && editModo === 'tasa' ? (
                      <input
                        type="number"
                        step="0.01"
                        autoFocus
                        value={tasaInput}
                        onChange={e => setTasaInput(e.target.value)}
                        onBlur={() => guardarEdicion(c)}
                        onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(c) }}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    ) : (
                      <button onClick={() => startEditTasa(c)} className="hover:underline">
                        {(c.tasa * 100).toFixed(1)}%
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {editando === c.id && editModo === 'monto' ? (
                      <input
                        type="number"
                        step="0.01"
                        autoFocus
                        value={montoInput}
                        onChange={e => setMontoInput(e.target.value)}
                        onBlur={() => guardarEdicion(c)}
                        onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(c) }}
                        className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                      />
                    ) : (
                      <button onClick={() => startEditMonto(c)} className="hover:underline">
                        ${c.monto.toLocaleString('es-AR')}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleEstado(c)}
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.estado === 'liquidada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {c.estado === 'liquidada' ? 'Liquidada' : 'Pendiente'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
