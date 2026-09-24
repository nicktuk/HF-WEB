'use client'

import { Fragment, useEffect, useState } from 'react'
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

interface Liquidacion {
  id: number
  semana_desde: string
  semana_hasta: string
  fecha_pago: string
  total: number
  medio_pago: string | null
  cantidad: number
}

interface SemanaEnCurso {
  semana_desde: string
  semana_hasta: string
  cantidad: number
  total: number
}

/** 'YYYY-MM-DD' -> 'dd/mm' sin pasar por Date (evita correr el día por zona horaria). */
function fechaCorta(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

interface MiPlata {
  grupos: GrupoComision[]
  comisiones_minoristas: ComisionMinorista[]
  total_pendiente: number
  total_liquidado: number
  ventas_sin_comision: VentaSinComision[]
  semana_en_curso: SemanaEnCurso
  liquidaciones: Liquidacion[]
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

            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
              <p className="text-xs text-zinc-500">
                Esta semana ({fechaCorta(plata.semana_en_curso.semana_desde)} al {fechaCorta(plata.semana_en_curso.semana_hasta)}) llevás
              </p>
              <p className="text-xl font-bold text-zinc-800">
                ${plata.semana_en_curso.total.toLocaleString('es-AR')}
                <span className="text-sm font-normal text-zinc-400"> · {plata.semana_en_curso.cantidad} comisiones</span>
              </p>
              <p className="text-xs text-zinc-400 mt-1">Las comisiones se liquidan por semana, de lunes a domingo.</p>
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
              <h2 className="text-sm font-semibold text-zinc-700 mb-2">Mis liquidaciones</h2>
              {plata.liquidaciones.length === 0 ? (
                <p className="text-sm text-zinc-400">Todavía no tenés liquidaciones.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Semana</th>
                        <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Pagado</th>
                        <th className="text-right py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Comisiones</th>
                        <th className="text-right py-2 pl-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {plata.liquidaciones.map(l => (
                        <tr key={l.id}>
                          <td className="py-2 pr-2 text-zinc-700 whitespace-nowrap">{fechaCorta(l.semana_desde)} al {fechaCorta(l.semana_hasta)}</td>
                          <td className="py-2 pr-2 text-zinc-500 whitespace-nowrap">
                            {fechaCorta(l.fecha_pago)}{l.medio_pago ? ` · ${l.medio_pago}` : ''}
                          </td>
                          <td className="py-2 pr-2 text-right text-zinc-500">{l.cantidad}</td>
                          <td className="py-2 pl-2 text-right font-medium text-emerald-600">${l.total.toLocaleString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
              <h2 className="text-sm font-semibold text-zinc-700 mb-2">Comisiones mayoristas por comercio</h2>
              {plata.grupos.length === 0 ? (
                <p className="text-sm text-zinc-400">Todavía no tenés comisiones mayoristas registradas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="pl-1" />
                        <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Comercio</th>
                        <th className="text-right py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Pedidos</th>
                        <th className="text-right py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total</th>
                        <th className="text-right py-2 pl-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Pendiente</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {plata.grupos.map(g => {
                        const key = g.comercio_id ?? -1
                        const abiertoAca = abierto === key
                        return (
                          <Fragment key={key}>
                            <tr onClick={() => toggle(key)} className="cursor-pointer hover:bg-zinc-50 transition-colors">
                              <td className="py-2 pl-1 text-zinc-400">
                                {abiertoAca ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </td>
                              <td className="py-2 pr-2 font-medium text-zinc-800 truncate max-w-[160px]">{g.comercio_nombre}</td>
                              <td className="py-2 pr-2 text-right text-zinc-500">{g.comisiones.length}</td>
                              <td className="py-2 pr-2 text-right font-semibold text-zinc-800">
                                ${(g.total_pendiente + g.total_liquidado).toLocaleString('es-AR')}
                              </td>
                              <td className="py-2 pl-2 text-right text-amber-600">
                                {g.total_pendiente > 0 ? `$${g.total_pendiente.toLocaleString('es-AR')}` : '—'}
                              </td>
                            </tr>
                            {abiertoAca && (
                              <tr>
                                <td colSpan={5} className="pb-3">
                                  <table className="w-full text-xs bg-zinc-50 rounded-lg">
                                    <thead>
                                      <tr className="text-zinc-400">
                                        <th className="text-left py-1.5 pl-3">Pedido</th>
                                        <th className="text-left py-1.5">Tasa</th>
                                        <th className="text-right py-1.5">Base</th>
                                        <th className="text-right py-1.5">Monto</th>
                                        <th className="text-right py-1.5 pr-3">Estado</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {g.comisiones.map(c => (
                                        <tr key={c.id}>
                                          <td className="py-1.5 pl-3 text-zinc-600">#{c.pedido_id}</td>
                                          <td className="py-1.5 text-zinc-600">{(c.tasa * 100).toFixed(0)}%</td>
                                          <td className="py-1.5 text-right text-zinc-600">${c.base.toLocaleString('es-AR')}</td>
                                          <td className="py-1.5 text-right font-medium text-zinc-800">${c.monto.toLocaleString('es-AR')}</td>
                                          <td className={`py-1.5 pr-3 text-right font-medium ${c.estado === 'liquidada' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                            {c.estado === 'liquidada' ? 'Liquidada' : 'Pendiente'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
              <h2 className="text-sm font-semibold text-zinc-700 mb-2">Comisiones minoristas</h2>
              {plata.comisiones_minoristas.length === 0 ? (
                <p className="text-sm text-zinc-400">Todavía no tenés comisiones minoristas generadas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">#</th>
                        <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cliente</th>
                        <th className="text-right py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Tasa</th>
                        <th className="text-right py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Monto</th>
                        <th className="text-right py-2 pl-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {plata.comisiones_minoristas.map(c => (
                        <tr key={c.id}>
                          <td className="py-2 pr-2 text-zinc-400">#{c.sale_id}</td>
                          <td className="py-2 pr-2 font-medium text-zinc-800 truncate max-w-[160px]">{c.cliente_nombre ?? '—'}</td>
                          <td className="py-2 pr-2 text-right text-zinc-500">{(c.tasa * 100).toFixed(0)}%</td>
                          <td className="py-2 pr-2 text-right font-medium text-zinc-800">${c.monto.toLocaleString('es-AR')}</td>
                          <td className={`py-2 pl-2 text-right font-medium ${c.estado === 'liquidada' ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {c.estado === 'liquidada' ? 'Liquidada' : 'Pendiente'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {plata.ventas_sin_comision.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                <h2 className="text-sm font-semibold text-zinc-700 mb-1">Ventas esperando comisión</h2>
                <p className="text-xs text-zinc-500 mb-3">
                  Ya están pagadas — HEFA todavía tiene que generar la comisión de cada una.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-100">
                        <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">#</th>
                        <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cliente</th>
                        <th className="text-right py-2 pl-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {plata.ventas_sin_comision.map(v => (
                        <tr key={v.id}>
                          <td className="py-2 pr-2 text-zinc-400">#{v.id}</td>
                          <td className="py-2 pr-2 font-medium text-zinc-800 truncate max-w-[160px]">{v.cliente_nombre ?? '—'}</td>
                          <td className="py-2 pl-2 text-right text-zinc-700">${v.total.toLocaleString('es-AR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  )
}
