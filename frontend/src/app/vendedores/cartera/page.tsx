'use client'

import { useEffect, useState } from 'react'
import { VendedorHeader } from '../_components/VendedorHeader'

interface ComercioCartera {
  id: number
  nombre_local: string
  nombre: string
  celular: string | null
  ubicacion_local: string
  semaforo: { color: string; dias_desde_ultimo_pedido: number | null }
}

const COLOR_SEMAFORO: Record<string, string> = {
  verde: 'bg-green-100 text-green-700',
  amarillo: 'bg-amber-100 text-amber-700',
  rojo: 'bg-red-100 text-red-700',
}

const LABEL_SEMAFORO: Record<string, string> = {
  verde: 'Activo',
  amarillo: 'Bajando el ritmo',
  rojo: 'A reactivar',
}

export default function MiCarteraPage() {
  const [cartera, setCartera] = useState<ComercioCartera[] | null>(null)

  useEffect(() => {
    fetch('/api/vendedores/mi-cartera')
      .then(res => (res.ok ? res.json() : []))
      .then(setCartera)
  }, [])

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mi cartera</h1>
          <p className="text-sm text-zinc-500">
            {cartera ? `${cartera.length} clientes activos` : 'Cargando...'}
          </p>
        </div>

        {cartera?.length === 0 && (
          <p className="text-sm text-zinc-400">Todavía no tenés clientes activos en tu cartera.</p>
        )}

        <div className="space-y-2">
          {cartera?.map(c => (
            <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-zinc-800 truncate">{c.nombre_local}</p>
                <p className="text-xs text-zinc-500 truncate">{c.nombre} · {c.ubicacion_local}</p>
                {c.celular && (
                  <a
                    href={`https://wa.me/${c.celular.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-green-600 hover:underline"
                  >
                    WhatsApp
                  </a>
                )}
              </div>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${COLOR_SEMAFORO[c.semaforo.color]}`}>
                {LABEL_SEMAFORO[c.semaforo.color]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
