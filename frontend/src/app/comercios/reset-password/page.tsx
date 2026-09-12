'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
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
      const res = await fetch('/api/comercios/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json() as { error?: string }

      if (!res.ok) {
        setError(data.error ?? 'El link no es válido o expiró. Pedí uno nuevo.')
        return
      }

      setOk(true)
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-3">
        Este link no es válido.{' '}
        <Link href="/comercios/olvide-password" className="underline">Pedí uno nuevo</Link>.
      </p>
    )
  }

  if (ok) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3">
          Tu contraseña se actualizó correctamente.
        </p>
        <Link
          href="/comercios"
          className="block text-center w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          Iniciar sesión
        </Link>
      </div>
    )
  }

  return (
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
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
          {error.includes('expiró') && (
            <>
              {' '}
              <Link href="/comercios/olvide-password" className="underline">Pedí un link nuevo</Link>.
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Guardando...' : 'Guardar nueva contraseña'}
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-zinc-200/80 p-8">
        <h1 className="text-xl font-semibold text-zinc-800 mb-6">Elegí tu nueva contraseña</h1>
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  )
}
