'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Percent, Headphones, Zap } from 'lucide-react'

const BENEFICIOS = [
  {
    icon: Percent,
    title: 'Precios especiales',
    text: 'Descuento fijo sobre el catálogo, sin negociar cada pedido.',
  },
  {
    icon: Headphones,
    title: 'Vendedor asignado',
    text: 'Un contacto directo por WhatsApp para coordinar pago y entrega.',
  },
  {
    icon: Zap,
    title: 'Pedido en minutos',
    text: 'Armá el pedido desde el catálogo y confirmalo sin vueltas.',
  },
]

export default function ComerciosLanding() {
  const [usuario, setUsuario] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/comercios/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      })
      const data = await res.json() as { error?: string; comercio?: { debe_cambiar_password?: boolean } }

      if (!res.ok) {
        setError(data.error ?? 'Error al iniciar sesión.')
        return
      }

      // Navegación dura: el router de Next.js cachea /comercios/catalogo
      // (staleTimes.dynamic en next.config.js) y un router.push podría
      // reusar la versión sin sesión ya visitada, mostrando el preview de
      // nuevo como si el login no hubiera funcionado.
      window.location.href = data.comercio?.debe_cambiar_password
        ? '/comercios/cambiar-password'
        : '/comercios/catalogo'
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      {/* Hero */}
      <section className="header-texture text-white py-16 sm:py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="text-3xl font-black tracking-[0.16em] text-white">HE·FA</span>
            <span className="text-[10px] uppercase tracking-[0.22em] text-blue-200/70 font-semibold border-l border-white/20 pl-3">
              Canal Comercios
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Precios de mayorista, sin vueltas</h1>
          <p className="text-lg text-blue-100/90 max-w-xl mx-auto">
            Para revendedores y comercios de bazar, hogar y electrodomésticos en zona sur GBA.
          </p>
          <p className="text-xl sm:text-2xl font-extrabold mt-3" style={{ color: '#FF7A50' }}>
            Comprá con tu cuenta aprobada al precio especial del canal
          </p>
        </div>

        {/* Beneficios */}
        <div className="max-w-4xl mx-auto mt-10 grid sm:grid-cols-3 gap-4">
          {BENEFICIOS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-white/10 border border-white/15 rounded-2xl p-4 text-center sm:text-left">
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/20 mb-2.5">
                <Icon className="h-4 w-4 text-emerald-300" />
              </div>
              <p className="text-sm font-semibold text-white">{title}</p>
              <p className="text-xs text-blue-100/70 mt-0.5">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Login + CTA */}
      <section className="max-w-md mx-auto px-4 -mt-8 pb-16 relative z-10">
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
              <Link href="/comercios/olvide-password" className="text-xs text-zinc-500 hover:text-primary-600 hover:underline">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-100 text-center">
            <p className="text-sm text-zinc-500 mb-3">¿Todavía no tenés cuenta?</p>
            <Link
              href="/comercios/solicitud"
              className="inline-block bg-white border border-zinc-300 text-zinc-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-50 transition-colors"
            >
              Solicitá tu código de acceso
            </Link>
          </div>
          <div className="mt-4 text-center">
            <Link href="/comercios/catalogo" className="text-xs text-zinc-400 hover:text-primary-600 hover:underline">
              Ver catálogo sin iniciar sesión
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
