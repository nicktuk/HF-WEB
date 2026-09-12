'use client'

import { useState } from 'react'

export default function CambiarPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/comercios/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json() as { error?: string }

      if (!res.ok) {
        setError(data.error ?? 'No pudimos cambiar tu contraseña.')
        return
      }

      // Navegación dura para que el middleware relea la cookie ya renovada.
      window.location.href = '/comercios/catalogo'
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-zinc-200/80 p-8">
        <h1 className="text-xl font-semibold text-zinc-800 mb-2">Elegí tu contraseña</h1>
        <p className="text-sm text-zinc-500 mb-6">
          Ingresaste con una contraseña temporal. Antes de seguir, elegí una nueva.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
              Nueva contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>

          <div>
            <label htmlFor="confirmar" className="block text-sm font-medium text-zinc-700 mb-1">
              Confirmar contraseña
            </label>
            <input
              id="confirmar"
              type="password"
              autoComplete="new-password"
              value={confirmar}
              onChange={e => setConfirmar(e.target.value)}
              required
              minLength={8}
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
            {loading ? 'Guardando...' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </main>
  )
}
