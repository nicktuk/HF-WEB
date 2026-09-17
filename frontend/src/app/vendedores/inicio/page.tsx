'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { VendedorHeader } from '../_components/VendedorHeader'
import { LinkPersonal } from '../_components/LinkPersonal'

interface VendedorInfo {
  id: number
  nombre: string
  usuario: string
  email: string | null
  link_personal: string
}

interface EntregaPendiente {
  pedido_id: number
  comercio_id: number
  comercio_nombre: string | null
  estado: string
  total: number
  fecha_reserva_hasta: string | null
}

interface ComercioCartera {
  id: number
  nombre_local: string
  nombre: string
  celular: string | null
  ubicacion_local: string
  semaforo: { color: string; dias_desde_ultimo_pedido: number | null }
}

interface Prospecto {
  id: number
  comercio_nombre: string
  whatsapp: string
  fecha_proximo_contacto: string | null
}

interface MiDia {
  entregas_pendientes: EntregaPendiente[]
  reactivar: ComercioCartera[]
  prospectos: Prospecto[]
}

const COLOR_SEMAFORO: Record<string, string> = {
  verde: 'bg-green-100 text-green-700',
  amarillo: 'bg-amber-100 text-amber-700',
  rojo: 'bg-red-100 text-red-700',
}

export default function MiDiaPage() {
  const [info, setInfo] = useState<VendedorInfo | null>(null)
  const [dia, setDia] = useState<MiDia | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/vendedores/info').then(res => (res.ok ? res.json() : null)),
      fetch('/api/vendedores/mi-dia').then(res => (res.ok ? res.json() : null)),
    ]).then(([infoData, diaData]) => {
      setInfo(infoData)
      setDia(diaData)
      setLoading(false)
    })
  }, [])

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader nombre={info?.nombre} />

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mi día</h1>
          <p className="text-sm text-zinc-500">Entregas primero, clientes a reactivar después, prospectos en los huecos.</p>
        </div>

        {info && <LinkPersonal link={info.link_personal} />}

        {loading ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
              <h2 className="text-sm font-semibold text-zinc-700 mb-3">
                Entregas pendientes {dia && `(${dia.entregas_pendientes.length})`}
              </h2>
              {!dia?.entregas_pendientes.length ? (
                <p className="text-sm text-zinc-400">No tenés entregas pendientes.</p>
              ) : (
                <ul className="space-y-2">
                  {dia.entregas_pendientes.map(e => (
                    <li key={e.pedido_id} className="flex items-center justify-between text-sm border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium text-zinc-800">{e.comercio_nombre ?? `Pedido #${e.pedido_id}`}</p>
                        <p className="text-xs text-zinc-500">{e.estado} · ${e.total.toLocaleString('es-AR')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
              <h2 className="text-sm font-semibold text-zinc-700 mb-3">
                Clientes a reactivar {dia && `(${dia.reactivar.length})`}
              </h2>
              {!dia?.reactivar.length ? (
                <p className="text-sm text-zinc-400">Ningún cliente necesita reactivación hoy.</p>
              ) : (
                <ul className="space-y-2">
                  {dia.reactivar.map(c => (
                    <li key={c.id} className="flex items-center justify-between text-sm border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
                      <div>
                        <p className="font-medium text-zinc-800">{c.nombre_local}</p>
                        <p className="text-xs text-zinc-500">{c.ubicacion_local}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COLOR_SEMAFORO[c.semaforo.color]}`}>
                        {c.semaforo.dias_desde_ultimo_pedido !== null
                          ? `${c.semaforo.dias_desde_ultimo_pedido}d sin pedir`
                          : 'Nunca pidió'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-zinc-700">
                  Prospectos a contactar {dia && `(${dia.prospectos.length})`}
                </h2>
                <Link href="/vendedores/prospectos" className="text-xs text-primary-600 hover:underline">
                  Ver todos
                </Link>
              </div>
              {!dia?.prospectos.length ? (
                <p className="text-sm text-zinc-400">No hay prospectos pendientes de contacto.</p>
              ) : (
                <ul className="space-y-2">
                  {dia.prospectos.map(p => (
                    <li key={p.id} className="flex items-center justify-between text-sm border-b border-zinc-100 pb-2 last:border-0 last:pb-0">
                      <p className="font-medium text-zinc-800">{p.comercio_nombre}</p>
                      <a
                        href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 hover:underline"
                      >
                        WhatsApp
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Link
              href="/vendedores/clientes/nuevo"
              className="block text-center w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              + Cargar alta de cliente
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
