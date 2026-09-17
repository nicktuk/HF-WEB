'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { VendedorHeader } from '../_components/VendedorHeader'

interface ComercioCartera {
  id: number
  nombre_local: string
  nombre: string
  celular: string | null
  ubicacion_local: string
  semaforo: { color: string; dias_desde_ultimo_pedido: number | null }
}

interface ProspectoCartera {
  id: number
  comercio_nombre: string
  whatsapp: string | null
  direccion: string | null
  estado: string
}

interface CarteraView {
  clientes: ComercioCartera[]
  prospectos: ProspectoCartera[]
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

const LABEL_ESTADO_PROSPECTO: Record<string, string> = {
  interesado: 'Interesado',
  lo_pienso: 'Lo piensa',
}

export default function MiCarteraPage() {
  const [cartera, setCartera] = useState<CarteraView | null>(null)

  useEffect(() => {
    fetch('/api/vendedores/mi-cartera')
      .then(res => (res.ok ? res.json() : null))
      .then(setCartera)
  }, [])

  const total = (cartera?.clientes.length ?? 0) + (cartera?.prospectos.length ?? 0)

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mi cartera</h1>
          <p className="text-sm text-zinc-500">
            {cartera ? `${total} en total: ${cartera.clientes.length} clientes, ${cartera.prospectos.length} prospectos` : 'Cargando...'}
          </p>
        </div>

        {cartera && total === 0 && (
          <p className="text-sm text-zinc-400">Todavía no tenés clientes ni prospectos cargados.</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {cartera?.clientes.map(c => (
            <div key={`cliente-${c.id}`} className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-zinc-800 truncate">{c.nombre_local}</p>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 bg-emerald-100 text-emerald-700`}>
                  Cliente
                </span>
              </div>
              <p className="text-xs text-zinc-500 truncate mb-2">{c.nombre} · {c.ubicacion_local}</p>
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COLOR_SEMAFORO[c.semaforo.color]}`}>
                  {LABEL_SEMAFORO[c.semaforo.color]}
                </span>
                {c.celular && (
                  <a
                    href={`https://wa.me/${c.celular.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}

          {cartera?.prospectos.map(p => (
            <div key={`prospecto-${p.id}`} className="bg-white rounded-2xl shadow-sm border border-dashed border-zinc-300 p-4">
              <div className="flex items-start justify-between gap-2 mb-1">
                <p className="font-medium text-zinc-800 truncate">{p.comercio_nombre}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 bg-violet-100 text-violet-700">
                  Prospecto
                </span>
              </div>
              <p className="text-xs text-zinc-500 truncate mb-2">{p.direccion ?? 'Sin dirección'}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                  {LABEL_ESTADO_PROSPECTO[p.estado] ?? p.estado}
                </span>
                {p.whatsapp && (
                  <a
                    href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-600"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
