'use client'

import { useState } from 'react'

export interface ClienteFormData {
  nombre: string
  apellido: string
  usuario: string
  password: string
  celular: string
  email: string
  nombre_local: string
  ubicacion_local: string
  rubro: string
}

interface Props {
  initial?: Partial<ClienteFormData>
  submitLabel: string
  onSubmit: (datos: ClienteFormData) => Promise<string | null>
}

const EMPTY: ClienteFormData = {
  nombre: '', apellido: '', usuario: '', password: '', celular: '',
  email: '', nombre_local: '', ubicacion_local: '', rubro: '',
}

export function ClienteForm({ initial, submitLabel, onSubmit }: Props) {
  const [form, setForm] = useState<ClienteFormData>({ ...EMPTY, ...initial })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function set(field: keyof ClienteFormData) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (!form.celular && !form.email) {
      setError('Ingresá al menos un celular o email.')
      return
    }
    setError(null)
    setLoading(true)
    const err = await onSubmit(form)
    setLoading(false)
    if (err) setError(err)
  }

  const inputClass = 'w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Nombre *</label>
          <input value={form.nombre} onChange={set('nombre')} required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Apellido *</label>
          <input value={form.apellido} onChange={set('apellido')} required className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Nombre del local *</label>
        <input value={form.nombre_local} onChange={set('nombre_local')} required className={inputClass} />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Dirección *</label>
        <input value={form.ubicacion_local} onChange={set('ubicacion_local')} required className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Celular</label>
          <input value={form.celular} onChange={set('celular')} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Email</label>
          <input type="email" value={form.email} onChange={set('email')} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700 mb-1">Rubro</label>
        <input value={form.rubro} onChange={set('rubro')} className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Usuario *</label>
          <input value={form.usuario} onChange={set('usuario')} required className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700 mb-1">Contraseña *</label>
          <input type="password" value={form.password} onChange={set('password')} required minLength={8} className={inputClass} />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Guardando...' : submitLabel}
      </button>
    </form>
  )
}
