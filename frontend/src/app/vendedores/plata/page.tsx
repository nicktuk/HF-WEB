'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { VendedorHeader } from '../_components/VendedorHeader'

interface ComisionItem {
  id: number
  pedido_id: number
  base: number
  tasa: number
  monto: number
  estado: string
}

interface GrupoComision {
  comercio_id: number | null
  comercio_nombre: string
  comisiones: ComisionItem[]
  total_pendiente: number
  total_liquidado: number
}

interface ComisionMinorista {
  id: number
  sale_id: number | null
  cliente_nombre: string | null
  base: number
  tasa: number
  monto: number
  estado: string
}

interface VentaSinComision {
  id: number
  cliente_nombre: string | null
  total: number
}

interface MiPlata {
  grupos: GrupoComision[]
  comisiones_minoristas: ComisionMinorista[]
  total_pendiente: number
  total_liquidado: number
  tiene_venta_minorista_vinculada: boolean
  ventas_sin_comision: VentaSinComision[]
}

export default function MiPlataPage() {
  const [plata, setPlata] = useState<MiPlata | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/vendedores/mi-plata')
      .then(res => (res.ok ? res.json() : null))
      .then(setPlata)
  }, [])

  function toggle(key: number) {
    setAbierto(a => (a === key ? null : key))
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mi plata</h1>
          <p className="text-sm text-zinc-500">Comisión por cada pedido mayorista pagado de tu cartera, agrupada por cliente.</p>
        </div>

        {!plata ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                <p className="text-xs text-zinc-500">Pendiente</p>
                <p className="text-xl font-bold text-amber-600">${plata.total_pendiente.toLocaleString('es-AR')}</p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                <p className="text-xs text-zinc-500">Liquidado</p>
                <p className="text-xl font-bold text-emerald-600">${plata.total_liquidado.toLocaleString('es-AR')}</p>
              </div>
            </div>

            {plata.grupos.length === 0 ? (
              <p className="text-sm text-zinc-400">Todavía no tenés comisiones mayoristas registradas.</p>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 divide-y divide-zinc-100">
                {plata.grupos.map(g => {
                  const key = g.comercio_id ?? -1
                  const abiertoAca = abierto === key
                  return (
                    <div key={key}>
                      <button
                        onClick={() => toggle(key)}
                        className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-zinc-50 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-zinc-800 truncate">{g.comercio_nombre}</p>
                          <p className="text-xs text-zinc-500">{g.comisiones.length} pedido(s) pagado(s)</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <p className="font-semibold text-zinc-800">
                              ${(g.total_pendiente + g.total_liquidado).toLocaleString('es-AR')}
                            </p>
                            {g.total_pendiente > 0 && (
                              <p className="text-xs text-amber-600">${g.total_pendiente.toLocaleString('es-AR')} pendiente</p>
                            )}
                          </div>
                          {abiertoAca ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                        </div>
                      </button>
                      {abiertoAca && (
                        <div className="px-4 pb-4 space-y-1.5">
                          {g.comisiones.map(c => (
                            <div key={c.id} className="flex items-center justify-between text-sm bg-zinc-50 rounded-lg px-3 py-2">
                              <span className="text-zinc-600">
                                Pedido #{c.pedido_id} · {(c.tasa * 100).toFixed(0)}% sobre ${c.base.toLocaleString('es-AR')}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-zinc-800">${c.monto.toLocaleString('es-AR')}</span>
                                <span className={`text-xs font-medium ${c.estado === 'liquidada' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  {c.estado === 'liquidada' ? 'Liquidada' : 'Pendiente'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!plata.tiene_venta_minorista_vinculada ? (
              <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                <h2 className="text-sm font-semibold text-zinc-700 mb-1">Ventas minoristas</h2>
                <p className="text-sm text-zinc-400">
                  Todavía no tenés vinculado tu usuario de venta minorista — pedile a HEFA que te lo asocie desde{' '}
                  <span className="font-mono text-xs">/admin/vendedores</span> para verlas acá.
                </p>
              </section>
            ) : (
              <>
                <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                  <h2 className="text-sm font-semibold text-zinc-700 mb-2">Comisiones minoristas</h2>
                  {plata.comisiones_minoristas.length === 0 ? (
                    <p className="text-sm text-zinc-400">Todavía no tenés comisiones minoristas generadas.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {plata.comisiones_minoristas.map(c => (
                        <div key={c.id} className="flex items-center justify-between text-sm bg-zinc-50 rounded-lg px-3 py-2">
                          <span className="text-zinc-600 truncate">
                            {c.cliente_nombre ?? `Venta #${c.sale_id}`} · {(c.tasa * 100).toFixed(0)}%
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-medium text-zinc-800">${c.monto.toLocaleString('es-AR')}</span>
                            <span className={`text-xs font-medium ${c.estado === 'liquidada' ? 'text-emerald-600' : 'text-amber-600'}`}>
                              {c.estado === 'liquidada' ? 'Liquidada' : 'Pendiente'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {plata.ventas_sin_comision.length > 0 && (
                  <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                    <h2 className="text-sm font-semibold text-zinc-700 mb-1">Ventas esperando comisión</h2>
                    <p className="text-xs text-zinc-500 mb-3">
                      Ya están pagadas — HEFA todavía tiene que generar la comisión de cada una.
                    </p>
                    <div className="space-y-1.5">
                      {plata.ventas_sin_comision.map(v => (
                        <div key={v.id} className="flex items-center justify-between text-sm bg-zinc-50 rounded-lg px-3 py-2">
                          <span className="text-zinc-600 truncate">{v.cliente_nombre ?? `Venta #${v.id}`}</span>
                          <span className="font-medium text-zinc-800">${v.total.toLocaleString('es-AR')}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}
