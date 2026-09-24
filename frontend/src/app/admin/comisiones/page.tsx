'use client'

import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { ChevronDown, ChevronRight, Printer } from 'lucide-react'
import { useApiKey } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'
const TZ = 'America/Argentina/Buenos_Aires'
const MEDIOS_PAGO = ['Transferencia', 'Efectivo', 'Mercado Pago']

function apiFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { 'X-Admin-API-Key': apiKey, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
}

async function errorDe(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return typeof body.detail === 'string' ? body.detail : 'No se pudo completar la operación.'
  } catch {
    return 'No se pudo completar la operación.'
  }
}

interface ComisionRow {
  id: number
  canal: 'mayorista' | 'minorista'
  vendedor_id: number
  vendedor_nombre: string | null
  pedido_id: number | null
  sale_id: number | null
  cliente_nombre: string | null
  base: number
  tasa: number
  monto: number
  estado: string
  liquidacion_id: number | null
  created_at: string | null
  semana_desde: string | null
}

interface VentaPendiente {
  sale_id: number
  cliente_nombre: string | null
  total: number
  vendedor_id: number | null
  vendedor_nombre: string | null
}

interface SemanaInfo {
  semana_desde: string
  semana_hasta: string
  cerrada: boolean
  en_curso: boolean
  pendiente_total: number
  pendiente_cantidad: number
  liquidado_total: number
}

interface VendedorSemana {
  vendedor_id: number
  vendedor_nombre: string | null
  cantidad: number
  total_mayorista: number
  total_minorista: number
  total: number
  comisiones: ComisionRow[]
}

interface Liquidacion {
  id: number
  vendedor_id: number
  vendedor_nombre: string | null
  semana_desde: string
  semana_hasta: string
  fecha_pago: string
  total: number
  medio_pago: string | null
  notas: string | null
  estado: 'confirmada' | 'anulada'
  expense_id: number | null
  cantidad: number
  comisiones?: ComisionRow[]
}

interface ResumenSemana {
  semana_desde: string
  semana_hasta: string
  cerrada: boolean
  en_curso: boolean
  vendedores: VendedorSemana[]
  total_pendiente: number
  liquidaciones: Liquidacion[]
  total_liquidado: number
}

const CANAL_LABEL: Record<string, string> = { mayorista: 'Mayorista', minorista: 'Minorista' }
const CANAL_COLOR: Record<string, string> = {
  mayorista: 'bg-indigo-100 text-indigo-700',
  minorista: 'bg-teal-100 text-teal-700',
}

const pesos = (n: number) => {
  const decimales = Number.isInteger(n) ? 0 : 2
  return `$${n.toLocaleString('es-AR', { minimumFractionDigits: decimales, maximumFractionDigits: decimales })}`
}

/** 'YYYY-MM-DD' -> 'dd/mm' (o 'dd/mm/yyyy'), sin pasar por Date para no correr el día por zona horaria. */
function fechaCorta(iso: string, conAnio = false) {
  const [y, m, d] = iso.split('-')
  return conAnio ? `${d}/${m}/${y}` : `${d}/${m}`
}

/** created_at viene en UTC sin zona. */
function fechaHoraAr(isoUtc: string | null) {
  if (!isoUtc) return '—'
  return new Date(`${isoUtc}Z`).toLocaleString('es-AR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

function hoyAr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ })
}

function sumarDias(iso: string, dias: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + dias))
  return dt.toISOString().slice(0, 10)
}

function rangoSemana(s: { semana_desde: string; semana_hasta: string }) {
  return `${fechaCorta(s.semana_desde)} al ${fechaCorta(s.semana_hasta, true)}`
}

function esc(texto: string) {
  return texto.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!))
}

function imprimirLiquidacion(l: Liquidacion) {
  const w = window.open('', '_blank', 'width=720,height=900')
  if (!w) return
  const filas = (l.comisiones ?? []).map(c => `
    <tr>
      <td>${CANAL_LABEL[c.canal]}</td>
      <td>${esc(c.cliente_nombre ?? '—')}</td>
      <td>${fechaHoraAr(c.created_at)}</td>
      <td class="r">${pesos(c.base)}</td>
      <td class="r">${(c.tasa * 100).toFixed(1)}%</td>
      <td class="r">${pesos(c.monto)}</td>
    </tr>`).join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Liquidación #${l.id}</title>
    <style>
      body{font-family:system-ui,sans-serif;color:#111;padding:24px;font-size:13px}
      h1{font-size:18px;margin:0 0 4px} p{margin:2px 0;color:#444}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border-bottom:1px solid #ddd;padding:6px 4px;text-align:left} th{font-size:11px;text-transform:uppercase;color:#666}
      .r{text-align:right} tfoot td{font-weight:700;border-top:2px solid #111}
    </style></head><body>
    <h1>Liquidación de comisiones #${l.id}</h1>
    <p><strong>Vendedor:</strong> ${esc(l.vendedor_nombre ?? '—')}</p>
    <p><strong>Semana:</strong> ${rangoSemana(l)}</p>
    <p><strong>Fecha de pago:</strong> ${fechaCorta(l.fecha_pago, true)}${l.medio_pago ? ` · ${esc(l.medio_pago)}` : ''}</p>
    ${l.notas ? `<p><strong>Notas:</strong> ${esc(l.notas)}</p>` : ''}
    ${l.estado === 'anulada' ? '<p><strong>ANULADA</strong></p>' : ''}
    <table><thead><tr><th>Canal</th><th>Cliente</th><th>Fecha</th><th class="r">Base</th><th class="r">Tasa</th><th class="r">Comisión</th></tr></thead>
    <tbody>${filas}</tbody>
    <tfoot><tr><td colspan="5">Total</td><td class="r">${pesos(l.total)}</td></tr></tfoot></table>
    <script>window.onload=()=>window.print()</script>
    </body></html>`)
  w.document.close()
}

type Tab = 'liquidar' | 'historial' | 'detalle'

export default function ComisionesAdminPage() {
  const apiKey = useApiKey() ?? ''
  const [tab, setTab] = useState<Tab>('liquidar')
  const [pendientesBackfill, setPendientesBackfill] = useState<VentaPendiente[]>([])
  const [generando, setGenerando] = useState<number | null>(null)
  const [generandoTodas, setGenerandoTodas] = useState(false)
  // Se incrementa después de cualquier cambio para que cada pestaña recargue.
  const [version, setVersion] = useState(0)
  const refrescar = useCallback(() => setVersion(v => v + 1), [])

  useEffect(() => {
    if (!apiKey) return
    apiFetch('/admin/ventas-minoristas/pendientes-comision', apiKey)
      .then(res => (res.ok ? res.json() : []))
      .then(setPendientesBackfill)
  }, [apiKey, version])

  async function generarComision(sale_id: number) {
    setGenerando(sale_id)
    await apiFetch(`/admin/ventas-minoristas/${sale_id}/generar-comision`, apiKey, { method: 'POST' })
    setGenerando(null)
    refrescar()
  }

  async function generarTodasLasPendientes() {
    setGenerandoTodas(true)
    await apiFetch('/admin/ventas-minoristas/generar-comisiones-pendientes', apiKey, { method: 'POST' })
    setGenerandoTodas(false)
    refrescar()
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'liquidar', label: 'A liquidar' },
    { key: 'historial', label: 'Historial' },
    { key: 'detalle', label: 'Detalle' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comisiones</h1>
        <p className="text-sm text-gray-500 mt-0.5">Se liquidan por semana, de lunes a domingo.</p>
      </div>

      {pendientesBackfill.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-amber-900">
              Ventas minoristas pagadas sin comisión generada ({pendientesBackfill.length})
            </h2>
            <button
              onClick={generarTodasLasPendientes}
              disabled={generandoTodas || generando !== null}
              className="text-xs font-medium bg-amber-700 text-white rounded-lg px-3 py-1.5 hover:bg-amber-800 disabled:opacity-50"
            >
              {generandoTodas ? 'Generando...' : 'Generar todas'}
            </button>
          </div>
          <div className="space-y-2">
            {pendientesBackfill.map(v => (
              <div key={v.sale_id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-gray-800">{v.cliente_nombre ?? `Venta #${v.sale_id}`}</span>
                  <span className="text-gray-400"> · {pesos(v.total)} · </span>
                  <span className="text-gray-500">{v.vendedor_nombre ?? 'sin vendedor'}</span>
                </div>
                <button
                  onClick={() => generarComision(v.sale_id)}
                  disabled={generando === v.sale_id}
                  className="text-xs font-medium bg-amber-600 text-white rounded-lg px-3 py-1.5 hover:bg-amber-700 disabled:opacity-50"
                >
                  {generando === v.sale_id ? 'Generando...' : 'Generar comisión'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${
              tab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'liquidar' && <TabLiquidar apiKey={apiKey} version={version} onCambio={refrescar} />}
      {tab === 'historial' && <TabHistorial apiKey={apiKey} version={version} onCambio={refrescar} />}
      {tab === 'detalle' && <TabDetalle apiKey={apiKey} version={version} onCambio={refrescar} />}
    </div>
  )
}

// ─── A liquidar ──────────────────────────────────────────────────────────────

function TabLiquidar({ apiKey, version, onCambio }: { apiKey: string; version: number; onCambio: () => void }) {
  const [semanas, setSemanas] = useState<SemanaInfo[]>([])
  const [semanaSel, setSemanaSel] = useState<string | null>(null)
  const [resumen, setResumen] = useState<ResumenSemana | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<number | null>(null)
  // vendedor_id -> ids de comisiones tildadas
  const [seleccion, setSeleccion] = useState<Record<number, Set<number>>>({})
  const [fechaPago, setFechaPago] = useState(hoyAr())
  const [medioPago, setMedioPago] = useState('Transferencia')
  const [notas, setNotas] = useState('')
  const [registrarGasto, setRegistrarGasto] = useState(true)
  const [liquidando, setLiquidando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) return
    apiFetch('/admin/liquidaciones/semanas', apiKey)
      .then(res => (res.ok ? res.json() : []))
      .then((data: SemanaInfo[]) => {
        setSemanas(data)
        // Por defecto, la última semana cerrada.
        setSemanaSel(sel => sel ?? data.find(s => s.cerrada)?.semana_desde ?? data[0]?.semana_desde ?? null)
      })
  }, [apiKey, version])

  useEffect(() => {
    if (!apiKey || !semanaSel) return
    setLoading(true)
    apiFetch(`/admin/liquidaciones/semana?desde=${semanaSel}`, apiKey)
      .then(res => (res.ok ? res.json() : null))
      .then((data: ResumenSemana | null) => {
        setResumen(data)
        const inicial: Record<number, Set<number>> = {}
        data?.vendedores.forEach(v => { inicial[v.vendedor_id] = new Set(v.comisiones.map(c => c.id)) })
        setSeleccion(inicial)
        setExpandido(null)
        setLoading(false)
      })
  }, [apiKey, semanaSel, version])

  const ultimaCerrada = semanas.find(s => s.cerrada)?.semana_desde
  const atrasadas = semanas.filter(s => s.cerrada && s.pendiente_cantidad > 0 && s.semana_desde !== ultimaCerrada)

  const seleccionados = useMemo(() => {
    if (!resumen) return []
    return resumen.vendedores
      .map(v => {
        const ids = seleccion[v.vendedor_id] ?? new Set<number>()
        const total = v.comisiones.filter(c => ids.has(c.id)).reduce((s, c) => s + c.monto, 0)
        return { vendedor: v, ids, total }
      })
      .filter(x => x.ids.size > 0)
  }, [resumen, seleccion])
  const totalSeleccionado = seleccionados.reduce((s, x) => s + x.total, 0)

  function toggleVendedor(v: VendedorSemana) {
    setSeleccion(prev => {
      const actual = prev[v.vendedor_id] ?? new Set<number>()
      const todas = actual.size === v.comisiones.length
      return { ...prev, [v.vendedor_id]: todas ? new Set() : new Set(v.comisiones.map(c => c.id)) }
    })
  }

  function toggleComision(vendedorId: number, comisionId: number) {
    setSeleccion(prev => {
      const next = new Set(prev[vendedorId] ?? [])
      if (next.has(comisionId)) next.delete(comisionId)
      else next.add(comisionId)
      return { ...prev, [vendedorId]: next }
    })
  }

  function toggleTodos() {
    if (!resumen) return
    const todosCompletos = resumen.vendedores.every(v => (seleccion[v.vendedor_id]?.size ?? 0) === v.comisiones.length)
    const next: Record<number, Set<number>> = {}
    resumen.vendedores.forEach(v => { next[v.vendedor_id] = todosCompletos ? new Set() : new Set(v.comisiones.map(c => c.id)) })
    setSeleccion(next)
  }

  async function liquidar() {
    if (!resumen || seleccionados.length === 0) return
    const msg = `¿Liquidar la semana ${rangoSemana(resumen)}?\n\n` +
      seleccionados.map(x => `• ${x.vendedor.vendedor_nombre ?? `Vendedor #${x.vendedor.vendedor_id}`}: ${pesos(x.total)}`).join('\n') +
      `\n\nTotal: ${pesos(totalSeleccionado)}` +
      (registrarGasto ? '\nSe registra un gasto por vendedor.' : '')
    if (!window.confirm(msg)) return

    setLiquidando(true)
    setError(null)
    setOk(null)
    const res = await apiFetch('/admin/liquidaciones', apiKey, {
      method: 'POST',
      body: JSON.stringify({
        semana_desde: resumen.semana_desde,
        fecha_pago: fechaPago || undefined,
        medio_pago: medioPago || undefined,
        notas: notas || undefined,
        registrar_gasto: registrarGasto,
        // Siempre mandamos los ids para liquidar exactamente lo que se ve en pantalla.
        vendedores: seleccionados.map(x => ({ vendedor_id: x.vendedor.vendedor_id, comision_ids: Array.from(x.ids) })),
      }),
    })
    setLiquidando(false)
    if (!res.ok) {
      setError(await errorDe(res))
      return
    }
    const creadas: Liquidacion[] = await res.json()
    setOk(`Listo: ${creadas.length} ${creadas.length === 1 ? 'liquidación' : 'liquidaciones'} por ${pesos(creadas.reduce((s, l) => s + l.total, 0))}.`)
    setNotas('')
    onCambio()
  }

  function estiloSemana(s: SemanaInfo) {
    if (s.en_curso) return 'border-gray-200 bg-gray-50 text-gray-600'
    if (s.pendiente_cantidad === 0) return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    if (s.semana_desde === ultimaCerrada) return 'border-amber-300 bg-amber-50 text-amber-900'
    return 'border-red-300 bg-red-50 text-red-800'
  }

  return (
    <div className="space-y-4">
      {atrasadas.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
          Hay {atrasadas.length} semana{atrasadas.length === 1 ? '' : 's'} anterior{atrasadas.length === 1 ? '' : 'es'} con comisiones sin liquidar
          ({pesos(atrasadas.reduce((s, x) => s + x.pendiente_total, 0))}).
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {semanas.map(s => (
          <button
            key={s.semana_desde}
            onClick={() => setSemanaSel(s.semana_desde)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-left ${estiloSemana(s)} ${
              semanaSel === s.semana_desde ? 'ring-2 ring-primary-500' : ''
            }`}
          >
            <p className="text-xs font-semibold whitespace-nowrap">{fechaCorta(s.semana_desde)} – {fechaCorta(s.semana_hasta)}</p>
            <p className="text-[11px] whitespace-nowrap">
              {s.en_curso
                ? `En curso · ${pesos(s.pendiente_total)}`
                : s.pendiente_cantidad > 0
                  ? `Pendiente ${pesos(s.pendiente_total)}`
                  : s.liquidado_total > 0 ? `Liquidada ${pesos(s.liquidado_total)}` : 'Sin comisiones'}
            </p>
          </button>
        ))}
      </div>

      {loading || !resumen ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Semana del {rangoSemana(resumen)}</h2>
              <p className="text-sm text-gray-500">
                Pendiente {pesos(resumen.total_pendiente)}
                {resumen.total_liquidado > 0 && <> · Ya liquidado {pesos(resumen.total_liquidado)}</>}
              </p>
            </div>
          </div>

          {resumen.en_curso && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600">
              Semana en curso: se puede liquidar a partir del lunes {fechaCorta(sumarDias(resumen.semana_hasta, 1))}.
            </div>
          )}

          {resumen.vendedores.length === 0 ? (
            <p className="text-sm text-gray-500">No hay comisiones pendientes en esta semana.</p>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 w-8">
                      {resumen.cerrada && (
                        <input
                          type="checkbox"
                          aria-label="Seleccionar todos"
                          checked={resumen.vendedores.every(v => (seleccion[v.vendedor_id]?.size ?? 0) === v.comisiones.length)}
                          onChange={toggleTodos}
                        />
                      )}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Comisiones</th>
                    <th className="hidden sm:table-cell text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Mayorista</th>
                    <th className="hidden sm:table-cell text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Minorista</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">A pagar</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {resumen.vendedores.map(v => {
                    const ids = seleccion[v.vendedor_id] ?? new Set<number>()
                    const parcial = ids.size > 0 && ids.size < v.comisiones.length
                    const aPagar = v.comisiones.filter(c => ids.has(c.id)).reduce((s, c) => s + c.monto, 0)
                    const abierto = expandido === v.vendedor_id
                    return (
                      <Fragment key={v.vendedor_id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            {resumen.cerrada && (
                              <input
                                type="checkbox"
                                aria-label={`Seleccionar ${v.vendedor_nombre ?? ''}`}
                                checked={ids.size === v.comisiones.length}
                                ref={el => { if (el) el.indeterminate = parcial }}
                                onChange={() => toggleVendedor(v)}
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-800">{v.vendedor_nombre ?? `Vendedor #${v.vendedor_id}`}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{v.cantidad}</td>
                          <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-600">{pesos(v.total_mayorista)}</td>
                          <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-600">{pesos(v.total_minorista)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">
                            {pesos(resumen.cerrada ? aPagar : v.total)}
                            {parcial && <span className="block text-[11px] font-normal text-gray-400">de {pesos(v.total)}</span>}
                          </td>
                          <td className="px-2 py-3">
                            <button
                              onClick={() => setExpandido(abierto ? null : v.vendedor_id)}
                              aria-label="Ver detalle"
                              className="p-1 text-gray-400 hover:text-gray-700"
                            >
                              {abierto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          </td>
                        </tr>
                        {abierto && (
                          <tr>
                            <td colSpan={7} className="bg-gray-50 px-4 py-3">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-gray-500">
                                    <th className="w-8" />
                                    <th className="text-left py-1">Canal</th>
                                    <th className="text-left py-1">Cliente</th>
                                    <th className="text-left py-1">Fecha</th>
                                    <th className="text-right py-1">Base</th>
                                    <th className="text-right py-1">Tasa</th>
                                    <th className="text-right py-1">Comisión</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {v.comisiones.map(c => (
                                    <tr key={c.id} className="border-t border-gray-200">
                                      <td className="py-1.5">
                                        {resumen.cerrada && (
                                          <input
                                            type="checkbox"
                                            checked={ids.has(c.id)}
                                            onChange={() => toggleComision(v.vendedor_id, c.id)}
                                          />
                                        )}
                                      </td>
                                      <td className="py-1.5">
                                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${CANAL_COLOR[c.canal]}`}>
                                          {CANAL_LABEL[c.canal]}
                                        </span>
                                      </td>
                                      <td className="py-1.5 text-gray-700">
                                        {c.cliente_nombre ?? '—'}
                                        <span className="text-gray-400"> · {c.pedido_id ? `Pedido #${c.pedido_id}` : `Venta #${c.sale_id}`}</span>
                                      </td>
                                      <td className="py-1.5 text-gray-500">{fechaHoraAr(c.created_at)}</td>
                                      <td className="py-1.5 text-right text-gray-500">{pesos(c.base)}</td>
                                      <td className="py-1.5 text-right text-gray-500">{(c.tasa * 100).toFixed(1)}%</td>
                                      <td className="py-1.5 text-right font-medium text-gray-800">{pesos(c.monto)}</td>
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

          {resumen.cerrada && resumen.vendedores.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-xs text-gray-500 space-y-1">
                  <span>Fecha de pago</span>
                  <input
                    type="date"
                    value={fechaPago}
                    onChange={e => setFechaPago(e.target.value)}
                    className="block w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900"
                  />
                </label>
                <label className="text-xs text-gray-500 space-y-1">
                  <span>Medio de pago</span>
                  <input
                    list="medios-pago"
                    value={medioPago}
                    onChange={e => setMedioPago(e.target.value)}
                    className="block w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900"
                  />
                  <datalist id="medios-pago">
                    {MEDIOS_PAGO.map(m => <option key={m} value={m} />)}
                  </datalist>
                </label>
                <label className="text-xs text-gray-500 space-y-1">
                  <span>Notas (opcional)</span>
                  <input
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                    className="block w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-900"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={registrarGasto} onChange={e => setRegistrarGasto(e.target.checked)} />
                  Registrar como gasto (uno por vendedor)
                </label>
                <button
                  onClick={liquidar}
                  disabled={liquidando || seleccionados.length === 0}
                  className="text-sm font-medium bg-emerald-600 text-white rounded-lg px-4 py-2 hover:bg-emerald-700 disabled:opacity-50"
                >
                  {liquidando
                    ? 'Liquidando...'
                    : `Liquidar ${seleccionados.length} vendedor${seleccionados.length === 1 ? '' : 'es'} · ${pesos(totalSeleccionado)}`}
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}
          {ok && <p className="text-sm text-emerald-700">{ok}</p>}

          {resumen.liquidaciones.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Ya liquidado en esta semana</h3>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {resumen.liquidaciones.map(l => (
                  <div key={l.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-gray-800">
                      {l.vendedor_nombre ?? `Vendedor #${l.vendedor_id}`}
                      <span className="text-gray-400"> · {l.cantidad} comisiones · pagado {fechaCorta(l.fecha_pago)}{l.medio_pago ? ` · ${l.medio_pago}` : ''}</span>
                    </span>
                    <span className="font-medium text-emerald-700">{pesos(l.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Historial ───────────────────────────────────────────────────────────────

function TabHistorial({ apiKey, version, onCambio }: { apiKey: string; version: number; onCambio: () => void }) {
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroVendedor, setFiltroVendedor] = useState<string>('')
  const [incluirAnuladas, setIncluirAnuladas] = useState(false)
  const [abierta, setAbierta] = useState<number | null>(null)
  const [detalles, setDetalles] = useState<Record<number, Liquidacion>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) return
    setLoading(true)
    const params = new URLSearchParams()
    if (incluirAnuladas) params.set('incluir_anuladas', 'true')
    apiFetch(`/admin/liquidaciones?${params.toString()}`, apiKey)
      .then(res => (res.ok ? res.json() : []))
      .then((data: Liquidacion[]) => { setLiquidaciones(data); setDetalles({}); setLoading(false) })
  }, [apiKey, incluirAnuladas, version])

  const vendedores = useMemo(() => {
    const m = new Map<number, string>()
    liquidaciones.forEach(l => m.set(l.vendedor_id, l.vendedor_nombre ?? `Vendedor #${l.vendedor_id}`))
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [liquidaciones])

  const porSemana = useMemo(() => {
    const filtradas = filtroVendedor ? liquidaciones.filter(l => String(l.vendedor_id) === filtroVendedor) : liquidaciones
    const grupos = new Map<string, Liquidacion[]>()
    filtradas.forEach(l => {
      const lista = grupos.get(l.semana_desde) ?? []
      lista.push(l)
      grupos.set(l.semana_desde, lista)
    })
    return Array.from(grupos.entries())
  }, [liquidaciones, filtroVendedor])

  async function cargarDetalle(id: number): Promise<Liquidacion | null> {
    if (detalles[id]) return detalles[id]
    const res = await apiFetch(`/admin/liquidaciones/${id}`, apiKey)
    if (!res.ok) return null
    const d: Liquidacion = await res.json()
    setDetalles(prev => ({ ...prev, [id]: d }))
    return d
  }

  async function toggleDetalle(id: number) {
    if (abierta === id) { setAbierta(null); return }
    await cargarDetalle(id)
    setAbierta(id)
  }

  async function imprimir(id: number) {
    const d = await cargarDetalle(id)
    if (d) imprimirLiquidacion(d)
  }

  async function anular(l: Liquidacion) {
    const msg = `¿Anular la liquidación de ${l.vendedor_nombre ?? 'este vendedor'} (${pesos(l.total)}, semana ${rangoSemana(l)})?\n\n` +
      'Sus comisiones vuelven a quedar pendientes' + (l.expense_id ? ' y se borra el gasto registrado.' : '.')
    if (!window.confirm(msg)) return
    setError(null)
    const res = await apiFetch(`/admin/liquidaciones/${l.id}/anular`, apiKey, { method: 'POST' })
    if (!res.ok) { setError(await errorDe(res)); return }
    onCambio()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filtroVendedor}
          onChange={e => setFiltroVendedor(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los vendedores</option>
          {vendedores.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={incluirAnuladas} onChange={e => setIncluirAnuladas(e.target.checked)} />
          Mostrar anuladas
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : porSemana.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay liquidaciones.</p>
      ) : (
        porSemana.map(([semana, lista]) => {
          const total = lista.filter(l => l.estado === 'confirmada').reduce((s, l) => s + l.total, 0)
          return (
            <div key={semana} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-2 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Semana del {rangoSemana(lista[0])}</h3>
                <span className="text-sm font-semibold text-emerald-700">{pesos(total)}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {lista.map(l => {
                  const detalle = detalles[l.id]
                  return (
                    <div key={l.id}>
                      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm ${l.estado === 'anulada' ? 'opacity-60' : ''}`}>
                        <button onClick={() => toggleDetalle(l.id)} className="flex items-center gap-1 font-medium text-gray-800 hover:underline">
                          {abierta === l.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {l.vendedor_nombre ?? `Vendedor #${l.vendedor_id}`}
                        </button>
                        <span className="text-gray-500">Pagado {fechaCorta(l.fecha_pago, true)}{l.medio_pago ? ` · ${l.medio_pago}` : ''}</span>
                        {l.estado === 'confirmada' && <span className="text-gray-400">{l.cantidad} comisiones</span>}
                        {l.estado === 'anulada' && (
                          <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">Anulada</span>
                        )}
                        {l.notas && <span className="text-gray-400 truncate max-w-xs" title={l.notas}>{l.notas}</span>}
                        <span className="ml-auto font-semibold text-gray-900">{pesos(l.total)}</span>
                        <button onClick={() => imprimir(l.id)} aria-label="Imprimir comprobante" className="p-1 text-gray-400 hover:text-gray-700">
                          <Printer className="h-4 w-4" />
                        </button>
                        {l.estado === 'confirmada' && (
                          <button onClick={() => anular(l)} className="text-xs text-red-600 hover:underline">Anular</button>
                        )}
                      </div>
                      {abierta === l.id && detalle && (
                        <div className="bg-gray-50 px-4 py-2">
                          {detalle.comisiones && detalle.comisiones.length > 0 ? (
                            <table className="w-full text-xs">
                              <tbody>
                                {detalle.comisiones.map(c => (
                                  <tr key={c.id} className="border-t border-gray-200 first:border-t-0">
                                    <td className="py-1.5">
                                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${CANAL_COLOR[c.canal]}`}>
                                        {CANAL_LABEL[c.canal]}
                                      </span>
                                    </td>
                                    <td className="py-1.5 text-gray-700">{c.cliente_nombre ?? '—'}</td>
                                    <td className="py-1.5 text-gray-500">{fechaHoraAr(c.created_at)}</td>
                                    <td className="py-1.5 text-right text-gray-500">{pesos(c.base)} · {(c.tasa * 100).toFixed(1)}%</td>
                                    <td className="py-1.5 text-right font-medium text-gray-800">{pesos(c.monto)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p className="text-xs text-gray-500">Sin comisiones asociadas (la liquidación fue anulada).</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Detalle / ajustes ───────────────────────────────────────────────────────

function TabDetalle({ apiKey, version, onCambio }: { apiKey: string; version: number; onCambio: () => void }) {
  const [comisiones, setComisiones] = useState<ComisionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroCanal, setFiltroCanal] = useState<'' | 'mayorista' | 'minorista'>('')
  const [filtroEstado, setFiltroEstado] = useState<'' | 'pendiente' | 'liquidada'>('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [editando, setEditando] = useState<number | null>(null)
  const [editModo, setEditModo] = useState<'monto' | 'tasa'>('monto')
  const [montoInput, setMontoInput] = useState('')
  const [tasaInput, setTasaInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Enter guarda y desmonta el input, lo que dispara también el onBlur: esto evita el doble PATCH.
  const guardandoRef = useRef(false)

  const fetchData = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroCanal) params.set('canal', filtroCanal)
    if (filtroEstado) params.set('estado', filtroEstado)
    if (desde) params.set('desde', desde)
    if (hasta) params.set('hasta', hasta)
    const res = await apiFetch(`/admin/comisiones?${params.toString()}`, apiKey)
    if (res.ok) setComisiones(await res.json())
    setLoading(false)
  }, [apiKey, filtroCanal, filtroEstado, desde, hasta])

  useEffect(() => { fetchData() }, [fetchData, version])

  function startEditMonto(c: ComisionRow) {
    setEditando(c.id)
    setEditModo('monto')
    setMontoInput(String(c.monto))
  }

  function startEditTasa(c: ComisionRow) {
    setEditando(c.id)
    setEditModo('tasa')
    setTasaInput((c.tasa * 100).toFixed(2))
  }

  async function guardarEdicion(c: ComisionRow) {
    if (guardandoRef.current) return
    guardandoRef.current = true
    const valor = parseFloat(editModo === 'monto' ? montoInput : tasaInput)
    setEditando(null)
    if (!isNaN(valor)) {
      setError(null)
      const res = await apiFetch(`/admin/comisiones/${c.id}`, apiKey, {
        method: 'PATCH',
        body: JSON.stringify(editModo === 'monto' ? { monto: valor } : { tasa: valor / 100 }),
      })
      if (!res.ok) setError(await errorDe(res))
      onCambio()
    }
    guardandoRef.current = false
  }

  const totalPendiente = comisiones.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.monto, 0)
  const totalLiquidado = comisiones.filter(c => c.estado === 'liquidada').reduce((s, c) => s + c.monto, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 max-w-md">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Pendiente</p>
          <p className="text-xl font-bold text-amber-600">{pesos(totalPendiente)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-500">Liquidado</p>
          <p className="text-xl font-bold text-emerald-600">{pesos(totalLiquidado)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select
          value={filtroCanal}
          onChange={e => setFiltroCanal(e.target.value as typeof filtroCanal)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los canales</option>
          <option value="mayorista">Mayorista</option>
          <option value="minorista">Minorista</option>
        </select>
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value as typeof filtroEstado)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="liquidada">Liquidada</option>
        </select>
        <label className="text-xs text-gray-500">Desde</label>
        <input type="date" value={desde} onChange={e => setDesde(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
        <label className="text-xs text-gray-500">Hasta</label>
        <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm" />
      </div>
      <p className="text-xs text-gray-400">Tocá la tasa o el monto de una comisión pendiente para ajustarla. Las liquidadas se editan anulando su liquidación.</p>
      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : comisiones.length === 0 ? (
        <p className="text-sm text-gray-500">No hay comisiones para este filtro.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Canal</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Base</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comisiones.map(c => {
                const editable = c.estado === 'pendiente'
                return (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${CANAL_COLOR[c.canal]}`}>
                        {CANAL_LABEL[c.canal]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{c.vendedor_nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.cliente_nombre ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{fechaHoraAr(c.created_at)}</td>
                    <td className="px-4 py-3 text-gray-500">{pesos(c.base)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {editando === c.id && editModo === 'tasa' ? (
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          value={tasaInput}
                          onChange={e => setTasaInput(e.target.value)}
                          onBlur={() => guardarEdicion(c)}
                          onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(c) }}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      ) : editable ? (
                        <button onClick={() => startEditTasa(c)} className="hover:underline">
                          {(c.tasa * 100).toFixed(1)}%
                        </button>
                      ) : (
                        <>{(c.tasa * 100).toFixed(1)}%</>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {editando === c.id && editModo === 'monto' ? (
                        <input
                          type="number"
                          step="0.01"
                          autoFocus
                          value={montoInput}
                          onChange={e => setMontoInput(e.target.value)}
                          onBlur={() => guardarEdicion(c)}
                          onKeyDown={e => { if (e.key === 'Enter') guardarEdicion(c) }}
                          className="w-24 border border-gray-300 rounded px-2 py-1 text-sm"
                        />
                      ) : editable ? (
                        <button onClick={() => startEditMonto(c)} className="hover:underline">
                          {pesos(c.monto)}
                        </button>
                      ) : (
                        <>{pesos(c.monto)}</>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.estado === 'liquidada' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {c.estado === 'liquidada' ? 'Liquidada' : 'Pendiente'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
