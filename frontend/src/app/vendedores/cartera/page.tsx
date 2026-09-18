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

        {!!cartera?.clientes.length && (
          <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">Clientes ({cartera.clientes.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">#</th>
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Comercio</th>
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Ubicación</th>
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Actividad</th>
                    <th className="text-right py-2 pl-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {cartera.clientes.map(c => (
                    <tr key={c.id}>
                      <td className="py-2 pr-2 text-zinc-400">#{c.id}</td>
                      <td className="py-2 pr-2 font-medium text-zinc-800 truncate max-w-[160px]">{c.nombre_local}</td>
                      <td className="py-2 pr-2 text-zinc-500 truncate max-w-[160px]">{c.ubicacion_local}</td>
                      <td className="py-2 pr-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COLOR_SEMAFORO[c.semaforo.color]}`}>
                          {LABEL_SEMAFORO[c.semaforo.color]}
                        </span>
                      </td>
                      <td className="py-2 pl-2 text-right">
                        {c.celular && (
                          <a
                            href={`https://wa.me/${c.celular.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 inline-flex"
                            aria-label="WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!!cartera?.prospectos.length && (
          <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
            <h2 className="text-sm font-semibold text-zinc-700 mb-2">Prospectos ({cartera.prospectos.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">#</th>
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Comercio</th>
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Dirección</th>
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Estado</th>
                    <th className="text-right py-2 pl-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">WhatsApp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {cartera.prospectos.map(p => (
                    <tr key={p.id}>
                      <td className="py-2 pr-2 text-zinc-400">#{p.id}</td>
                      <td className="py-2 pr-2 font-medium text-zinc-800 truncate max-w-[160px]">{p.comercio_nombre}</td>
                      <td className="py-2 pr-2 text-zinc-500 truncate max-w-[160px]">{p.direccion ?? 'Sin dirección'}</td>
                      <td className="py-2 pr-2">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
                          {LABEL_ESTADO_PROSPECTO[p.estado] ?? p.estado}
                        </span>
                      </td>
                      <td className="py-2 pl-2 text-right">
                        {p.whatsapp && (
                          <a
                            href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 inline-flex"
                            aria-label="WhatsApp"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
