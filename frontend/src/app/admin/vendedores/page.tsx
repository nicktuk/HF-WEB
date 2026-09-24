'use client'

import { useState, useEffect, useCallback } from 'react'
import { useApiKey } from '@/hooks/useAuth'
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

interface Vendedor {
  id: number
  nombre: string
  celular_wa: string
  email: string | null
  activo: boolean
  es_mayorista: boolean
  usuario: string | null
  tiene_credenciales: boolean
  debe_cambiar_password: boolean
  comision_mayorista_nuevo_porcentaje: number | null
  comision_mayorista_recompra_porcentaje: number | null
}

function apiFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { 'X-Admin-API-Key': apiKey, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
}

function sugerirUsuario(nombre: string): string {
  return nombre
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
}

const emptyForm = {
  nombre: '', celular_wa: '', email: '', es_mayorista: false,
  comisionMayoristaNuevo: '', comisionMayoristaRecompra: '',
}

export default function VendedoresAdminPage() {
  const apiKey = useApiKey() ?? ''
  const [vendedores, setVendedores] = useState<Vendedor[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [credencialesTarget, setCredencialesTarget] = useState<Vendedor | null>(null)
  const [usuarioInput, setUsuarioInput] = useState('')
  const [credencialesError, setCredencialesError] = useState<string | null>(null)
  const [credencialesResult, setCredencialesResult] = useState<{ usuario: string; otp: string } | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [asignando, setAsignando] = useState(false)

  const fetchData = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    const res = await apiFetch('/admin/vendedores', apiKey)
    if (res.ok) setVendedores(await res.json())
    setLoading(false)
  }, [apiKey])

  useEffect(() => { fetchData() }, [fetchData])

  async function toggleMayorista(v: Vendedor) {
    await apiFetch(`/admin/vendedores/${v.id}`, apiKey, {
      method: 'PATCH',
      body: JSON.stringify({ es_mayorista: !v.es_mayorista }),
    })
    await fetchData()
  }

  function startAdd() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setShowForm(true)
  }

  function startEdit(v: Vendedor) {
    setEditingId(v.id)
    setForm({
      nombre: v.nombre, celular_wa: v.celular_wa, email: v.email ?? '', es_mayorista: v.es_mayorista,
      comisionMayoristaNuevo: v.comision_mayorista_nuevo_porcentaje != null ? String(v.comision_mayorista_nuevo_porcentaje) : '',
      comisionMayoristaRecompra: v.comision_mayorista_recompra_porcentaje != null ? String(v.comision_mayorista_recompra_porcentaje) : '',
    })
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
    const body = {
      nombre: form.nombre.trim(),
      celular_wa: form.celular_wa.trim(),
      email: form.email.trim() || null,
      es_mayorista: form.es_mayorista,
      comision_mayorista_nuevo_porcentaje: form.comisionMayoristaNuevo.trim() ? Number(form.comisionMayoristaNuevo) : null,
      comision_mayorista_recompra_porcentaje: form.comisionMayoristaRecompra.trim() ? Number(form.comisionMayoristaRecompra) : null,
    }
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

  function abrirCredenciales(v: Vendedor) {
    setCredencialesTarget(v)
    setUsuarioInput(v.usuario ?? sugerirUsuario(v.nombre))
    setCredencialesError(null)
    setCredencialesResult(null)
    setCopiado(false)
  }

  async function confirmarCredenciales() {
    if (!credencialesTarget) return
    const usuario = usuarioInput.trim().toLowerCase()
    if (!usuario) {
      setCredencialesError('El usuario es obligatorio.')
      return
    }
    setAsignando(true)
    setCredencialesError(null)
    const res = await apiFetch(`/admin/vendedores/${credencialesTarget.id}/asignar-credenciales`, apiKey, {
      method: 'POST',
      body: JSON.stringify({ usuario }),
    })
    if (res.ok) {
      const data = await res.json() as { usuario: string; otp: string }
      setCredencialesResult(data)
      await fetchData()
    } else {
      const d = await res.json().catch(() => ({}))
      setCredencialesError(d.detail ?? 'No se pudo asignar el usuario/contraseña.')
    }
    setAsignando(false)
  }

  async function copiarOtp(otp: string) {
    try {
      await navigator.clipboard.writeText(otp)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de clipboard: el usuario igual puede seleccionar el texto del input.
    }
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
              <div className="flex items-center gap-2 pt-6">
                <input
                  id="es_mayorista"
                  type="checkbox"
                  checked={form.es_mayorista}
                  onChange={e => setForm(f => ({ ...f, es_mayorista: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="es_mayorista" className="text-sm text-gray-700">
                  Es mayorista (portal de comercios: cartera, prospectos, comisiones)
                </label>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Comisión mayorista de este vendedor</p>
              <p className="text-xs text-gray-500 mb-2">
                Vacío = usa el % general de Comercios → Configuración. La minorista es la matriz semanal general
                (Ventas → Comisión minorista), igual para todos.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Mayorista nuevo %</label>
                  <input
                    type="number" min="0" max="100" step="0.01"
                    placeholder="General"
                    value={form.comisionMayoristaNuevo}
                    onChange={e => setForm(f => ({ ...f, comisionMayoristaNuevo: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Mayorista recompra %</label>
                  <input
                    type="number" min="0" max="100" step="0.01"
                    placeholder="General"
                    value={form.comisionMayoristaRecompra}
                    onChange={e => setForm(f => ({ ...f, comisionMayoristaRecompra: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Portal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mayorista</th>
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
                  <td className="px-4 py-3 text-gray-500">
                    {v.tiene_credenciales ? (
                      <div className="flex flex-col">
                        <span className="text-gray-700">{v.usuario}</span>
                        {v.debe_cambiar_password && (
                          <span className="text-xs text-amber-600">Pendiente 1er login</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">Sin acceso</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleMayorista(v)}
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        v.es_mayorista ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {v.es_mayorista ? 'Sí' : 'No'}
                    </button>
                  </td>
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
                  <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                    <button
                      onClick={() => abrirCredenciales(v)}
                      className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                      {v.tiene_credenciales ? 'Resetear acceso' : 'Asignar acceso'}
                    </button>
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

      <Modal
        isOpen={credencialesTarget !== null}
        onClose={() => setCredencialesTarget(null)}
        title={credencialesResult ? 'Contraseña temporal asignada' : `Asignar acceso al portal — ${credencialesTarget?.nombre ?? ''}`}
        size="sm"
      >
        <ModalContent className="space-y-3">
          {credencialesResult ? (
            <>
              <p className="text-sm text-gray-600">
                Comunicásela a <strong>{credencialesTarget?.nombre}</strong> por WhatsApp — no se vuelve a mostrar.
                Usuario: <strong>{credencialesResult.usuario}</strong>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={credencialesResult.otp}
                  onFocus={e => e.target.select()}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-wider text-center focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
                <button
                  onClick={() => copiarOtp(credencialesResult.otp)}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                >
                  {copiado ? 'Copiado ✓' : 'Copiar'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Elegí el usuario con el que va a entrar a <code>/vendedores</code>. Se le genera una
                contraseña temporal que deberá cambiar en su primer login.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                <input
                  type="text"
                  value={usuarioInput}
                  onChange={e => setUsuarioInput(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
              {credencialesError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{credencialesError}</p>
              )}
            </>
          )}
        </ModalContent>
        <ModalFooter>
          {credencialesResult ? (
            <button
              onClick={() => setCredencialesTarget(null)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                onClick={() => setCredencialesTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarCredenciales}
                disabled={asignando}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {asignando ? 'Generando...' : 'Generar contraseña temporal'}
              </button>
            </>
          )}
        </ModalFooter>
      </Modal>
    </div>
  )
}
