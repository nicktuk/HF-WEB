'use client'

import { useEffect, useState } from 'react'

interface VendedorInfo {
  id: number
  nombre: string
  usuario: string
  email: string | null
}

export default function VendedorInicioPage() {
  const [info, setInfo] = useState<VendedorInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/vendedores/info')
      .then(res => (res.ok ? res.json() : null))
      .then(setInfo)
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    await fetch('/api/vendedores/auth/logout', { method: 'POST' })
    window.location.href = '/vendedores'
  }

  return (
    <main className="min-h-screen px-4 py-10" style={{ backgroundColor: '#f7f4ef' }}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <span className="text-2xl font-black tracking-[0.16em] text-zinc-800">HE·FA</span>
          <button
            onClick={handleLogout}
            className="text-xs text-zinc-500 hover:text-zinc-800 underline"
          >
            Cerrar sesión
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-zinc-200/80 p-8">
          {loading ? (
            <p className="text-sm text-zinc-400">Cargando...</p>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-zinc-800 mb-2">
                Hola, {info?.nombre ?? 'vendedor'}
              </h1>
              <p className="text-sm text-zinc-500">
                Tu cuenta ({info?.usuario}) ya está lista. Todavía no hay pantallas de trabajo
                cargadas acá — vienen en la próxima etapa.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
