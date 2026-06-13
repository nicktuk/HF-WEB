'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApiKey } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

interface Vendedor {
  id: number
  nombre: string
  celular_wa: string
  email: string | null
  activo: boolean
}

function apiFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { 'X-Admin-API-Key': apiKey, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
}

const emptyForm = { nombre: '', celular_wa: '', email: '' }

export default function VendedoresAdminPage() {
  const apiKey = useApiKey() ?? ''
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    const res = await apiFetch('/admin/vendedores', apiKey)
    if (res.ok) setVendedores(await res.json())
    setLoading(false)
  }, [apiKey])

  useEffect(() => { fetchData() }, [fetchData])

  function startAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function startEdit(v: Vendedor) {
    setEditingId(v.id)
    setForm({ nombre: v.nombre, celular_wa: v.celular_wa, email: v.email ?? '' })
    setError(null)
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const body = { nombre: form.nombre.trim(), celular_wa: form.celular_wa.trim(), email: form.email.trim() || null }
    const res = editingId
      ? await apiFetch(`/admin/vendedores/${editingId}`, apiKey, { method: 'PATCH', body: JSON.stringify(body) })
      : await apiFetch('/admin/vendedores', apiKey, { method: 'POST', body: JSON.stringify(body) })
    if (res.ok) {
      await fetchData()
      cancelForm()
    } else {
      const d = await res.json()
      setError(d.detail ?? 'Error al guardar')
    }
    setSaving(false)
  }

  async function toggleActivo(v: Vendedor) {
    await apiFetch(`/admin/vendedores/${v.id}`, apiKey, {
      method: 'PATCH',
      body: JSON.stringify({ activo: !v.activo }),
    })
    await fetchData()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendedores</h1>
          <p className="text-sm text-gray-500 mt-0.5">{vendedores.length} vendedores registrados</p>
        </div>
        <button
          onClick={startAdd}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          + Agregar vendedor
        </button>
      </div>

      {/* Formulario */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4">
            {editingId ? 'Editar vendedor' : 'Nuevo vendedor'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Celular WhatsApp *</label>
                <input
                  type="text"
                  placeholder="549XXXXXXXXXX"
                  value={form.celular_wa}
                  onChange={e => setForm(f => ({ ...f, celular_wa: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabla */}
      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : vendedores.length === 0 ? (
        <p className="text-sm text-gray-500">No hay vendedores registrados.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">WhatsApp</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendedores.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">
                    <a
                      href={`https://wa.me/${v.celular_wa}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-600 hover:underline"
                    >
                      {v.celular_wa}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{v.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActivo(v)}
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        v.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {v.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(v)}
                      className="text-xs text-gray-500 hover:text-gray-900 underline"
                    >
                      Editar
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
