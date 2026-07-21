'use client'

import { useState } from 'react'
import { useApiKey } from '@/hooks/useAuth'
import {
  useCatalogSellers,
  useCreateCatalogSeller,
  useUpdateCatalogSeller,
  useDeactivateCatalogSeller,
} from '@/hooks/useProducts'
import type { CatalogSeller } from '@/types'

const emptyForm = { nombre: '', celular: '' }

export default function VendedoresCatalogoPage() {
  const apiKey = useApiKey() ?? ''
  const { data: vendedores, isLoading } = useCatalogSellers(apiKey)
  const createSeller = useCreateCatalogSeller(apiKey)
  const updateSeller = useUpdateCatalogSeller(apiKey)
  const deactivateSeller = useDeactivateCatalogSeller(apiKey)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  function startAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function startEdit(v: CatalogSeller) {
    setEditingId(v.id)
    setForm({ nombre: v.nombre, celular: v.celular ?? '' })
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
    const data = { nombre: form.nombre.trim(), celular: form.celular.trim() || null }
    try {
      if (editingId) {
        await updateSeller.mutateAsync({ id: editingId, data })
      } else {
        await createSeller.mutateAsync(data)
      }
      cancelForm()
    } catch {
      setError('Error al guardar')
    }
  }

  async function toggleActivo(v: CatalogSeller) {
    if (v.activo) {
      await deactivateSeller.mutateAsync(v.id)
    } else {
      await updateSeller.mutateAsync({ id: v.id, data: { activo: true } })
    }
  }

  const saving = createSeller.isPending || updateSeller.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendedores</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {vendedores?.length ?? 0} vendedores del canal catálogo (ventas, pedidos, depósitos y compras)
          </p>
        </div>
        <button
          onClick={startAdd}
          className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors"
        >
          + Agregar vendedor
        </button>
      </div>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Celular</label>
                <input
                  type="text"
                  placeholder="549XXXXXXXXXX"
                  value={form.celular}
                  onChange={e => setForm(f => ({ ...f, celular: e.target.value }))}
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

      {isLoading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : !vendedores?.length ? (
        <p className="text-sm text-gray-500">No hay vendedores registrados.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nombre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Celular</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vendedores.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{v.nombre}</td>
                  <td className="px-4 py-3 text-gray-600">{v.celular ?? '—'}</td>
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
