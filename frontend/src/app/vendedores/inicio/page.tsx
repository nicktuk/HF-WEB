'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Truck, Flame, UserPlus, Store, MessageCircle } from 'lucide-react'
import { VendedorHeader } from '../_components/VendedorHeader'

interface VendedorInfo {
  id: number
  nombre: string
}

interface EntregaPendiente {
  canal: 'mayorista' | 'minorista'
  id: number
  cliente_nombre: string | null
  estado: string
  total: number
  fecha_limite: string | null
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
  whatsapp: string | null
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

function SectionCard({
  icon: Icon, iconBg, iconColor, title, count, children,
}: {
  icon: React.ElementType
  iconBg: string
  iconColor: string
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </div>
        <h2 className="text-sm font-semibold text-zinc-700 flex-1">{title}</h2>
        {count !== undefined && (
          <span className="text-xs font-medium text-zinc-400 bg-zinc-100 rounded-full px-2 py-0.5">{count}</span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mi día</h1>
          <p className="text-sm text-zinc-500">Entregas primero, clientes a reactivar después, prospectos en los huecos.</p>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <SectionCard icon={Truck} iconBg="bg-blue-100" iconColor="text-blue-600" title="Entregas pendientes" count={dia?.entregas_pendientes.length}>
              {!dia?.entregas_pendientes.length ? (
                <p className="text-sm text-zinc-400">No tenés entregas pendientes.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {dia.entregas_pendientes.map(e => (
                    <div key={`${e.canal}-${e.id}`} className="border border-zinc-100 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-zinc-800 text-sm truncate">{e.cliente_nombre ?? `#${e.id}`}</p>
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                          e.canal === 'mayorista' ? 'bg-indigo-100 text-indigo-700' : 'bg-teal-100 text-teal-700'
                        }`}>
                          {e.canal === 'mayorista' ? 'Mayorista' : 'Minorista'}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">{e.estado} · ${e.total.toLocaleString('es-AR')}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard icon={Flame} iconBg="bg-amber-100" iconColor="text-amber-600" title="Clientes a reactivar" count={dia?.reactivar.length}>
              {!dia?.reactivar.length ? (
                <p className="text-sm text-zinc-400">Ningún cliente necesita reactivación hoy.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {dia.reactivar.map(c => (
                    <div key={c.id} className="border border-zinc-100 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-800 text-sm truncate">{c.nombre_local}</p>
                        <p className="text-xs text-zinc-500 truncate">{c.ubicacion_local}</p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${COLOR_SEMAFORO[c.semaforo.color]}`}>
                        {c.semaforo.dias_desde_ultimo_pedido !== null ? `${c.semaforo.dias_desde_ultimo_pedido}d` : 'Nunca'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard icon={UserPlus} iconBg="bg-violet-100" iconColor="text-violet-600" title="Prospectos a contactar" count={dia?.prospectos.length}>
              {!dia?.prospectos.length ? (
                <p className="text-sm text-zinc-400">No tenés prospectos cargados todavía.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {dia.prospectos.map(p => (
                    <div key={p.id} className="border border-zinc-100 rounded-xl p-3 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-800 text-sm truncate">{p.comercio_nombre}</p>
                        <p className="text-xs text-zinc-400">
                          {p.fecha_proximo_contacto ? `Contacto: ${p.fecha_proximo_contacto}` : 'Sin fecha'}
                        </p>
                      </div>
                      {p.whatsapp && (
                        <a
                          href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-600 shrink-0"
                          aria-label="WhatsApp"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Link href="/vendedores/prospectos" className="inline-block mt-3 text-xs text-primary-600 hover:underline">
                Ver todos los prospectos →
              </Link>
            </SectionCard>

            <Link
              href="/vendedores/clientes/nuevo"
              className="flex items-center justify-center gap-2 w-full bg-primary-600 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-primary-700 transition-colors"
            >
              <Store className="h-4 w-4" />
              Cargar alta de cliente
            </Link>
          </>
        )}
      </div>
    </main>
  )
}
