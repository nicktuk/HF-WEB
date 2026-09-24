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

interface TramoSemana {
  monto_desde: number
  monto_hasta: number | null
  porcentaje: number
  alcanzado: boolean
  actual: boolean
  monto_en_tramo: number
}

interface VentaSemana {
  id: number
  sale_id: number | null
  cliente_nombre: string | null
  fecha: string
  base: number
  base_oferta: number
  tasa: number
  monto: number
  estado: string
  manual: boolean
}

interface SemanaMinorista {
  semana_inicio: string
  semana_fin: string
  cerrada: boolean
  escalonada: boolean
  volumen: number
  volumen_normal: number
  volumen_oferta: number
  tramos: TramoSemana[]
  porcentaje_normal: number
  porcentaje_oferta: number
  siguiente_tramo: { monto_desde: number; porcentaje: number; falta: number } | null
  comision_total: number
  comision_pendiente: number
  comision_liquidada: number
  ventas: VentaSemana[]
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

interface MiPlata {
  grupos: GrupoComision[]
  semanas_minoristas: SemanaMinorista[]
  total_pendiente: number
  total_liquidado: number
  ventas_sin_comision: VentaSinComision[]
  semana_en_curso: SemanaEnCurso
  liquidaciones: Liquidacion[]
}

const pesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`
const pct = (n: number) => `${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`

function fechaCorta(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

function rangoTramo(t: TramoSemana) {
  if (t.monto_hasta == null) return t.monto_desde > 0 ? `Más de ${pesos(t.monto_desde)}` : 'Desde $0'
  return t.monto_desde > 0
    ? `${pesos(t.monto_desde)} a ${pesos(t.monto_hasta)}`
    : `Hasta ${pesos(t.monto_hasta)}`
}

function DetalleSemana({ s }: { s: SemanaMinorista }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-zinc-50 rounded-xl p-3">
          <p className="text-xs text-zinc-500">Vendido en la semana</p>
          <p className="text-lg font-bold text-zinc-800">{pesos(s.volumen)}</p>
          {s.volumen_oferta > 0 && (
            <p className="text-[11px] text-zinc-400">
              {pesos(s.volumen_normal)} normal + {pesos(s.volumen_oferta)} en ofertas
            </p>
          )}
        </div>
        <div className="bg-zinc-50 rounded-xl p-3">
          <p className="text-xs text-zinc-500">{s.cerrada ? 'Comisión de la semana' : 'Comisión hasta ahora'}</p>
          <p className="text-lg font-bold text-amber-600">{pesos(s.comision_total)}</p>
          {!s.cerrada && <p className="text-[11px] text-zinc-400">Provisoria, se cierra el domingo</p>}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1.5">
          Matriz {s.escalonada ? '(escalonada)' : '(sobre toda la venta)'}
        </p>
        <div className="space-y-1.5">
          {s.tramos.map((t, i) => (
            <div
              key={i}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm border ${
                t.actual
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold'
                  : t.alcanzado
                    ? 'bg-emerald-50/40 border-emerald-100 text-emerald-700'
                    : 'bg-white border-zinc-200 text-zinc-400'
              }`}
            >
              <span>
                {rangoTramo(t)}
                {s.escalonada && t.monto_en_tramo > 0 && (
                  <span className="ml-1 text-[11px] font-normal">· {pesos(t.monto_en_tramo)} en este tramo</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                {t.actual && <span className="text-[10px] uppercase tracking-wide">Alcanzado</span>}
                {pct(t.porcentaje)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm border bg-sky-50 border-sky-200 text-sky-800">
            <span>
              Ofertas
              <span className="ml-1 text-[11px] font-normal">· {pesos(s.volumen_oferta)} vendido</span>
            </span>
            <span>{pct(s.porcentaje_oferta)}</span>
          </div>
        </div>
        {s.escalonada && s.volumen_normal > 0 && (
          <p className="text-[11px] text-zinc-400 mt-1.5">
            Con el escalonado tu venta normal queda en un promedio de {pct(s.porcentaje_normal)}.
          </p>
        )}
        {!s.cerrada && s.siguiente_tramo && (
          <p className="text-xs text-zinc-600 mt-2">
            Superá {pesos(s.siguiente_tramo.monto_desde)} esta semana (te faltan {pesos(s.siguiente_tramo.falta)})
            para pasar al {pct(s.siguiente_tramo.porcentaje)}.
          </p>
        )}
      </div>

      {s.ventas.length > 0 && (
        <div className="divide-y divide-zinc-100 border-t border-zinc-100">
          {s.ventas.map(v => (
            <div key={v.id} className="flex items-center gap-3 py-2 text-xs">
              <div className="flex-1 min-w-0">
                <p className="text-zinc-700 truncate">#{v.sale_id} {v.cliente_nombre ?? ''}</p>
                <p className="text-[11px] text-zinc-400">
                  {pesos(v.base)} · {pct(v.tasa * 100)}
                  {v.base_oferta > 0 && <span className="text-sky-600"> · {pesos(v.base_oferta)} en oferta</span>}
                  {v.manual && ' · % fijo'}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-medium text-zinc-800">{pesos(v.monto)}</p>
                <p className={`text-[11px] font-medium ${v.estado === 'liquidada' ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {v.estado === 'liquidada' ? 'Liquidada' : 'Pendiente'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MiPlataPage() {
  const [plata, setPlata] = useState<MiPlata | null>(null)
  const [abierto, setAbierto] = useState<number | null>(null)
  const [semanaAbierta, setSemanaAbierta] = useState<string | null>(null)

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
          <p className="text-sm text-zinc-500">
            Tu comisión minorista de la semana y la de cada pedido mayorista pagado de tu cartera.
          </p>
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

            {plata.semanas_minoristas.length > 0 && (() => {
              const [actual, ...anteriores] = plata.semanas_minoristas
              return (
                <>
                  <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                    <div className="flex items-baseline justify-between mb-3">
                      <h2 className="text-sm font-semibold text-zinc-700">Minorista · semana actual</h2>
                      <span className="text-xs text-zinc-400">
                        {fechaCorta(actual.semana_inicio)} al {fechaCorta(actual.semana_fin)}
                      </span>
                    </div>
                    <DetalleSemana s={actual} />
                  </section>

                  {anteriores.length > 0 && (
                    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                      <h2 className="text-sm font-semibold text-zinc-700 mb-2">Minorista · semanas anteriores</h2>
                      <div className="divide-y divide-zinc-100">
                        {anteriores.map(s => {
                          const abiertaAca = semanaAbierta === s.semana_inicio
                          const tramo = s.tramos.find(t => t.actual)
                          return (
                            <div key={s.semana_inicio}>
                              <button
                                type="button"
                                onClick={() => setSemanaAbierta(a => (a === s.semana_inicio ? null : s.semana_inicio))}
                                className="w-full flex items-center gap-2 py-2.5 text-sm text-left hover:bg-zinc-50 transition-colors"
                              >
                                <span className="text-zinc-400">
                                  {abiertaAca ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                </span>
                                <span className="flex-1 text-zinc-700">
                                  {fechaCorta(s.semana_inicio)} al {fechaCorta(s.semana_fin)}
                                  <span className="block text-[11px] text-zinc-400">
                                    Vendiste {pesos(s.volumen)}
                                    {tramo && ` · tramo ${pct(s.escalonada ? s.porcentaje_normal : tramo.porcentaje)}`}
                                  </span>
                                </span>
                                <span className="text-right">
                                  <span className="block font-semibold text-zinc-800">{pesos(s.comision_total)}</span>
                                  {s.comision_total > 0 && (
                                    <span className={`block text-[11px] font-medium ${s.comision_pendiente > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                      {s.comision_pendiente > 0 ? 'Pendiente' : 'Liquidada'}
                                    </span>
                                  )}
                                </span>
                              </button>
                              {abiertaAca && (
                                <div className="pb-3">
                                  <DetalleSemana s={s} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )}
                </>
              )
            })()}

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
