'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCategories } from '@/hooks/useProducts'

export default function SolicitudComercioPage() {
  const [form, setForm] = useState({
    nombre: '', apellido: '', usuario: '', password: '', confirmar: '',
    celular: '', email: '', nombre_local: '', ubicacion_local: '', rubro: '',
    website: '', // honeypot — debe quedar vacío
  })
  const [rubrosInteres, setRubrosInteres] = useState<string[]>([])
  const { data: categorias } = useCategories()
  const [errors, setErrors] = useState<Partial<typeof form & { general: string }>>({})
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  function toggleRubroInteres(nombre: string) {
    setRubrosInteres(prev =>
      prev.includes(nombre) ? prev.filter(r => r !== nombre) : [...prev, nombre]
    )
  }

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [field]: e.target.value }))
  }

  function validate() {
    const e: typeof errors = {}
    if (!form.nombre.trim()) e.nombre = 'Requerido'
    if (!form.apellido.trim()) e.apellido = 'Requerido'
    if (!form.usuario.trim()) e.usuario = 'Requerido'
    if (form.password.length < 8) e.password = 'Mínimo 8 caracteres'
    if (form.password !== form.confirmar) e.confirmar = 'Las contraseñas no coinciden'
    if (!form.celular && !form.email) e.celular = 'Ingresá al menos celular o email'
    if (!form.nombre_local.trim()) e.nombre_local = 'Requerido'
    if (!form.ubicacion_local.trim()) e.ubicacion_local = 'Requerido'
    return e
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setLoading(true)

    try {
      const { confirmar, ...payload } = form
      const res = await fetch('/api/comercios/solicitud', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, rubros_interes: rubrosInteres }),
      })
      const data = await res.json() as { error?: string; detail?: string }

      if (!res.ok) {
        const msg = data.error ?? data.detail ?? 'Error al enviar la solicitud.'
        setErrors({ general: msg })
        return
      }

      setDone(true)
    } catch {
      setErrors({ general: 'Error de conexión. Intentá de nuevo.' })
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f7f4ef' }}>
        <div className="bg-white rounded-2xl shadow-lg border border-zinc-200/80 p-10 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 text-2xl mb-4">✓</div>
          <h2 className="text-xl font-semibold text-zinc-800 mb-2">¡Solicitud recibida!</h2>
          <p className="text-zinc-600 text-sm">
            Te vamos a contactar para activar tu cuenta.
          </p>
          <Link href="/comercios" className="mt-6 inline-block text-sm text-primary-600 font-medium hover:underline">
            Volver al inicio
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen py-12 px-4" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <Link href="/comercios" className="text-sm text-zinc-500 hover:underline">
            ← Volver
          </Link>
          <h1 className="text-2xl font-bold text-zinc-800 mt-3">Solicitud de acceso comercio</h1>
          <p className="text-sm text-zinc-500 mt-1">Completá el formulario y te contactamos para activar tu cuenta.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-zinc-200/80 p-8 space-y-5">
          {/* Honeypot — oculto visualmente, no con display:none */}
          <div style={{ position: 'absolute', left: '-9999px', opacity: 0, pointerEvents: 'none' }} aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nombre" error={errors.nombre}>
              <input type="text" value={form.nombre} onChange={set('nombre')} className={input(errors.nombre)} />
            </Field>
            <Field label="Apellido" error={errors.apellido}>
              <input type="text" value={form.apellido} onChange={set('apellido')} className={input(errors.apellido)} />
            </Field>
          </div>

          <Field label="Usuario deseado" error={errors.usuario} hint="Solo letras, números y guión bajo">
            <input type="text" value={form.usuario} onChange={set('usuario')} autoComplete="username" className={input(errors.usuario)} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Contraseña" error={errors.password} hint="Mínimo 8 caracteres">
              <input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" className={input(errors.password)} />
            </Field>
            <Field label="Confirmar contraseña" error={errors.confirmar}>
              <input type="password" value={form.confirmar} onChange={set('confirmar')} autoComplete="new-password" className={input(errors.confirmar)} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Celular" error={errors.celular} hint="Al menos uno de los dos">
              <input type="tel" value={form.celular} onChange={set('celular')} className={input(errors.celular)} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={set('email')} className={input(errors.email)} />
            </Field>
          </div>

          <Field label="Nombre del local" error={errors.nombre_local}>
            <input type="text" value={form.nombre_local} onChange={set('nombre_local')} className={input(errors.nombre_local)} />
          </Field>

          <Field label="Ubicación del local" error={errors.ubicacion_local} hint="Localidad y dirección">
            <textarea value={form.ubicacion_local} onChange={set('ubicacion_local')} rows={2} className={input(errors.ubicacion_local) + ' resize-none'} />
          </Field>

          <Field label="Rubro del comercio" hint="Ej: Bazar, Ferretería, Electrodomésticos (opcional)">
            <input type="text" value={form.rubro} onChange={set('rubro')} className={input()} />
          </Field>

          {categorias && categorias.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ¿Qué rubros te interesaría comprar? <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {categorias.map(c => (
                  <label key={c.name} className="flex items-center gap-2 text-sm text-gray-600">
                    <input
                      type="checkbox"
                      checked={rubrosInteres.includes(c.name)}
                      onChange={() => toggleRubroInteres(c.name)}
                      className="rounded border-gray-300"
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {errors.general && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {errors.general}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Enviando...' : 'Enviar solicitud'}
          </button>
        </form>
      </div>
    </main>
  )
}

function Field({ label, error, hint, children }: {
  label: string; error?: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  )
}

function input(error?: string) {
  return `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ${
    error ? 'border-red-300 focus:ring-red-200' : 'border-zinc-300 focus:ring-primary-300 focus:border-primary-400'
  }`
}
