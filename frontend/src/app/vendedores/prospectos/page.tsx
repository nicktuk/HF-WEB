'use client'

import { useEffect, useState, useCallback } from 'react'
import { VendedorHeader } from '../_components/VendedorHeader'
import { ClienteForm, type ClienteFormData, type ClienteFormResult } from '../_components/ClienteForm'
import { Modal, ModalContent } from '@/components/ui/modal'

interface Prospecto {
  id: number
  comercio_nombre: string
  whatsapp: string | null
  direccion: string | null
  estado: string
  fecha_proximo_contacto: string | null
  notas: string | null
  comercio_id: number | null
}

const ESTADOS: Record<string, { label: string; color: string }> = {
  interesado: { label: 'Interesado', color: 'bg-blue-100 text-blue-700' },
  lo_pienso: { label: 'Lo piensa', color: 'bg-amber-100 text-amber-700' },
  no_va: { label: 'No va', color: 'bg-zinc-100 text-zinc-500' },
  convertido: { label: 'Convertido', color: 'bg-emerald-100 text-emerald-700' },
}

const emptyForm = { comercio_nombre: '', whatsapp: '', direccion: '', fecha_proximo_contacto: '', notas: '' }

export default function ProspectosPage() {
  const [prospectos, setProspectos] = useState<Prospecto[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [convirtiendo, setConvirtiendo] = useState<Prospecto | null>(null)
  const [otpConvertido, setOtpConvertido] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/vendedores/prospectos')
    if (res.ok) setProspectos(await res.json())
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleCrear(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await fetch('/api/vendedores/prospectos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, fecha_proximo_contacto: form.fecha_proximo_contacto || null }),
    })
    if (res.ok) {
      await fetchData()
      setForm(emptyForm)
      setShowForm(false)
    } else {
      const d = await res.json()
      setError(d.detail ?? 'Error al guardar')
    }
    setSaving(false)
  }

  async function cambiarEstado(p: Prospecto, estado: string) {
    await fetch(`/api/vendedores/prospectos/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    })
    await fetchData()
  }

  async function handleConvertir(datos: ClienteFormData): Promise<ClienteFormResult> {
    if (!convirtiendo) return { ok: false, error: 'Error interno.' }
    const res = await fetch(`/api/vendedores/prospectos/${convirtiendo.id}/convertir`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    const data = await res.json() as { detail?: string; otp?: string }
    if (!res.ok || !data.otp) return { ok: false, error: data.detail ?? 'No se pudo convertir el prospecto.' }
    return { ok: true, otp: data.otp }
  }

  function handleConvertirExito(otp: string) {
    setConvirtiendo(null)
    setOtpConvertido(otp)
    fetchData()
  }

  async function copiarOtp() {
    if (!otpConvertido) return
    try {
      await navigator.clipboard.writeText(otpConvertido)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de clipboard: el usuario igual puede seleccionar el texto del input.
    }
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-800">Prospectos</h1>
            <p className="text-sm text-zinc-500">Comercios visitados que todavía no son clientes.</p>
          </div>
          <button
            onClick={() => { setShowForm(true); setError(null) }}
            className="bg-primary-600 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-primary-700 transition-colors shrink-0"
          >
            + Nuevo
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 text-xs text-blue-800">
          Un prospecto es solo tu registro de seguimiento (todavía no tiene cuenta ni ve precios).
          <strong> Convertir a cliente</strong> es lo que realmente da de alta la cuenta — con usuario y
          contraseña — y la manda a aprobación de HEFA, igual que una alta directa.
        </div>

        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
            <form onSubmit={handleCrear} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Nombre del comercio *</label>
                <input
                  value={form.comercio_nombre}
                  onChange={e => setForm(f => ({ ...f, comercio_nombre: e.target.value }))}
                  required
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">WhatsApp</label>
                  <input
                    value={form.whatsapp}
                    onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                    placeholder="Si todavía no lo tenés, dejalo vacío"
                    className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Próximo contacto</label>
                  <input
                    type="date"
                    value={form.fecha_proximo_contacto}
                    onChange={e => setForm(f => ({ ...f, fecha_proximo_contacto: e.target.value }))}
                    className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Dirección</label>
                <input
                  value={form.direccion}
                  onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
                  rows={2}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
                />
              </div>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-primary-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-zinc-100 text-zinc-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {!prospectos ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : prospectos.length === 0 ? (
          <p className="text-sm text-zinc-400">No cargaste prospectos todavía.</p>
        ) : (
          <div className="space-y-2">
            {prospectos.map(p => (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-800 truncate">{p.comercio_nombre}</p>
                    <p className="text-xs text-zinc-500">{p.direccion}</p>
                    {p.fecha_proximo_contacto && (
                      <p className="text-xs text-zinc-400">Próximo contacto: {p.fecha_proximo_contacto}</p>
                    )}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${ESTADOS[p.estado].color}`}>
                    {ESTADOS[p.estado].label}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-zinc-100">
                  {p.whatsapp && (
                    <a
                      href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green-600 hover:underline"
                    >
                      WhatsApp
                    </a>
                  )}
                  {p.estado !== 'convertido' && (
                    <>
                      {p.estado !== 'lo_pienso' && (
                        <button onClick={() => cambiarEstado(p, 'lo_pienso')} className="text-xs text-amber-600 hover:underline">
                          Lo piensa
                        </button>
                      )}
                      {p.estado !== 'no_va' && (
                        <button onClick={() => cambiarEstado(p, 'no_va')} className="text-xs text-zinc-500 hover:underline">
                          No va
                        </button>
                      )}
                      <button
                        onClick={() => setConvirtiendo(p)}
                        className="text-xs text-emerald-600 hover:underline font-medium ml-auto"
                      >
                        Convertir a cliente
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={convirtiendo !== null}
        onClose={() => setConvirtiendo(null)}
        title={`Convertir a cliente — ${convirtiendo?.comercio_nombre ?? ''}`}
        size="md"
      >
        <ModalContent>
          {convirtiendo && (
            <ClienteForm
              submitLabel="Cargar alta"
              initial={{ nombre_local: convirtiendo.comercio_nombre, celular: convirtiendo.whatsapp ?? '' }}
              onSubmit={handleConvertir}
              onSuccess={handleConvertirExito}
            />
          )}
        </ModalContent>
      </Modal>

      <Modal
        isOpen={otpConvertido !== null}
        onClose={() => setOtpConvertido(null)}
        title="Cliente convertido ✓"
        size="sm"
      >
        <ModalContent className="space-y-3">
          <p className="text-sm text-gray-600">
            Pasale esta contraseña temporal por WhatsApp — no se vuelve a mostrar.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={otpConvertido ?? ''}
              onFocus={e => e.target.select()}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono tracking-wider text-center"
            />
            <button
              onClick={copiarOtp}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
            >
              {copiado ? 'Copiado ✓' : 'Copiar'}
            </button>
          </div>
        </ModalContent>
      </Modal>
    </main>
  )
}
