'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function VendedoresLanding() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/vendedores/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      })
      const data = await res.json() as { error?: string; vendedor?: { debe_cambiar_password?: boolean } }

      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar sesión.')
        return
      }

      // Navegación dura para que el middleware relea la cookie recién seteada.
      window.location.href = data.vendedor?.debe_cambiar_password
        ? '/vendedores/cambiar-password'
        : '/vendedores/inicio'
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-3xl font-black tracking-[0.16em] text-zinc-800">HE·FA</span>
          <p className="text-sm uppercase tracking-[0.35em] font-extrabold text-zinc-500 mt-2">
            Portal Vendedores
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-zinc-200/80 p-8">
          <h2 className="text-xl font-semibold text-zinc-800 mb-6">Iniciar sesión</h2>

          <form onSubmit={handleLogin} className="space-y-4">
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

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-1">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
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
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>

            <div className="text-center">
              <Link href="/vendedores/olvide-password" className="text-xs text-zinc-500 hover:text-primary-600 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-100 text-center">
            <p className="text-xs text-zinc-400">
              ¿No tenés usuario todavía? Pedile a HEFA que te lo asigne.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
