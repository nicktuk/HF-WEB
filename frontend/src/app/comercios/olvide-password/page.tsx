'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function OlvidePasswordPage() {
  const [usuario, setUsuario] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setMensaje(null)
    setLoading(true)

    try {
      const res = await fetch('/api/comercios/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario }),
      })
      const data = await res.json() as { mensaje?: string; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Error al procesar el pedido.')
        return
      }

      setMensaje(data.mensaje ?? 'Si el usuario existe, te enviamos instrucciones.')
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-zinc-200/80 p-8">
        <h1 className="text-xl font-semibold text-zinc-800 mb-2">Olvidé mi contraseña</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Ingresá tu usuario y te enviamos instrucciones para reestablecer tu contraseña.
        </p>

        {mensaje ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3">
            {mensaje}
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="usuario" className="block text-sm font-medium text-zinc-700 mb-1">
                Usuario
              </label>
              <input
                id="usuario"
                type="text"
                autoComplete="username"
                value={usuario}
                onChange={e => setUsuario(e.target.value)}
                required
                className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Enviando...' : 'Enviar instrucciones'}
            </button>
          </form>
        )}

        <div className="mt-6 pt-6 border-t border-zinc-100 text-center">
          <Link href="/comercios" className="text-sm text-zinc-500 hover:text-primary-600 hover:underline">
            Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </main>
  )
}
