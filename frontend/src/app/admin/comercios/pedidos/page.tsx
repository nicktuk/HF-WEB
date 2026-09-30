'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useApiKey } from '@/hooks/useAuth'
import { uploadImages, resolveImageUrl } from '@/lib/api'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

const ESTADOS = {
  recibido:        { label: 'Recibido',        color: 'bg-blue-100 text-blue-700' },
  confirmado:      { label: 'Confirmado',      color: 'bg-indigo-100 text-indigo-700' },
  preparando:      { label: 'En preparación',  color: 'bg-yellow-100 text-yellow-700' },
  entregado:       { label: 'Entregado',       color: 'bg-green-100 text-green-700' },
  entrega_parcial: { label: 'Entrega parcial', color: 'bg-orange-100 text-orange-700' },
  cancelado:       { label: 'Cancelado',       color: 'bg-red-100 text-red-700' },
} as const

type EstadoPedido = keyof typeof ESTADOS

const ESTADOS_ENTREGA: EstadoPedido[] = ['entregado', 'entrega_parcial']

// Qué le pasa al stock (y a la venta) con cada cambio de estado manual; ver
// comercio_pedidos.cambiar_estado en el backend.
function avisoCambioEstado(actual: EstadoPedido, nuevo: EstadoPedido): string | null {
  if (nuevo === 'cancelado') {
    return '¿Cancelar el pedido? Se devuelve al stock lo entregado y se elimina su venta.'
  }
  if (nuevo === 'entregado') {
    return '¿Marcar como entregado? Se entrega todo lo pendiente y se descuenta del stock.'
  }
  if (ESTADOS_ENTREGA.includes(actual)) {
    return `¿Pasar a "${ESTADOS[nuevo].label}"? Se devuelve al stock todo lo entregado.`
  }
  return null
}

interface Comision {
  monto: number
  tasa: number
  estado: string
}

interface Pedido {
  id: number
  comercio_id: number
  comercio_nombre: string | null
  comercio_local: string | null
  vendedor_nombre: string | null
  estado: EstadoPedido
  estado_pago: 'pendiente' | 'pagado'
  metodo_pago: string | null
  fecha_pago: string | null
  foto_entrega_url: string | null
  comision: Comision | null
  comision_porcentaje_manual: number | null
  comision_monto_manual: number | null
  total: number
  notas: string | null
  created_at: string | null
  venta_id: number | null
  venta_sin_vendedor: boolean
}

interface PedidoSinVenta {
  pedido_id: number
  comercio_local: string | null
  total: number
  sin_vendedor: boolean
}

interface PedidoDetalle extends Pedido {
  items: {
    id: number
    nombre_producto: string
    cantidad: number
    cantidad_entregada: number
    precio_unitario: number
    precio_original: number | null
    subtotal: number
  }[]
  entregas: {
    id: number
    fecha: string
    foto_url: string | null
    origen: 'admin' | 'vendedor' | 'migracion'
    items: { pedido_item_id: number; nombre_producto: string | null; cantidad: number }[]
  }[]
}

function formatFecha(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function apiFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { 'X-Admin-API-Key': apiKey, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
}

async function alertarSiFallo(res: Response) {
  if (res.ok) return
  let detalle = 'No se pudo completar la acción.'
  try {
    const body = await res.json()
    if (typeof body?.detail === 'string') detalle = body.detail
  } catch {
    // respuesta sin JSON: queda el mensaje genérico
  }
  alert(detalle)
}

export default function PedidosComercioAdminPage() {
  const apiKey = useApiKey() ?? ''
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detalle, setDetalle] = useState<PedidoDetalle | null>(null)
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [sinVenta, setSinVenta] = useState<{ a_generar: PedidoSinVenta[]; sin_vendedor: PedidoSinVenta[] } | null>(null)
  const [generando, setGenerando] = useState(false)

  const fetchSinVenta = useCallback(async () => {
    if (!apiKey) return
    const res = await apiFetch('/admin/comercios/pedidos/generar-ventas', apiKey)
    if (res.ok) setSinVenta(await res.json())
  }, [apiKey])

  useEffect(() => { fetchSinVenta() }, [fetchSinVenta])

  async function generarVentas() {
    if (!sinVenta) return
    const n = sinVenta.a_generar.length
    if (!confirm(`Se van a generar ${n} ventas de pedidos anteriores, con la fecha original de cada pedido. No se toca el stock. ¿Continuar?`)) return
    setGenerando(true)
    const res = await apiFetch('/admin/comercios/pedidos/generar-ventas', apiKey, { method: 'POST' })
    await alertarSiFallo(res)
    setGenerando(false)
    await fetchSinVenta()
    await fetchData()
  }

  const fetchData = useCallback(async () => {
    if (!apiKey) return
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroEstado) params.set('estado', filtroEstado)
    const res = await apiFetch(`/admin/comercios/pedidos?${params}&limit=100`, apiKey)
    if (res.ok) {
      const d = await res.json()
      setPedidos(d.items)
      setTotal(d.total)
    }
    setLoading(false)
  }, [apiKey, filtroEstado])

  useEffect(() => { fetchData() }, [fetchData])

  // Link "Ver pedido" desde Ventas: /admin/comercios/pedidos?pedido=<id>
  useEffect(() => {
    if (!apiKey) return
    const id = Number(new URLSearchParams(window.location.search).get('pedido'))
    if (id) {
      setExpandedId(id)
      refreshDetalle(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey])

  async function refreshDetalle(id: number) {
    const res = await apiFetch(`/admin/comercios/pedidos/${id}`, apiKey)
    if (res.ok) setDetalle(await res.json())
  }

  async function toggleDetalle(id: number) {
    if (expandedId === id) {
      setExpandedId(null)
      setDetalle(null)
      return
    }
    setExpandedId(id)
    await refreshDetalle(id)
  }

  async function cambiarEstado(p: Pedido, estado: EstadoPedido) {
    const id = p.id
    const aviso = avisoCambioEstado(p.estado, estado)
    if (aviso && !confirm(aviso)) return
    setUpdatingId(id)
    const res = await apiFetch(`/admin/comercios/pedidos/${id}/estado`, apiKey, {
      method: 'PATCH',
      body: JSON.stringify({ estado }),
    })
    await alertarSiFallo(res)
    await fetchData()
    if (expandedId === id) await refreshDetalle(id)
    setUpdatingId(null)
  }

  async function registrarPago(id: number, metodoPago: string) {
    setUpdatingId(id)
    const res = await apiFetch(`/admin/comercios/pedidos/${id}/pago`, apiKey, {
      method: 'POST',
      body: JSON.stringify({ metodo_pago: metodoPago }),
    })
    await alertarSiFallo(res)
    await fetchData()
    await refreshDetalle(id)
    setUpdatingId(null)
  }

  async function entregarPedido(id: number, fotoUrl: string, entregas: Record<number, number>) {
    setUpdatingId(id)
    const res = await apiFetch(`/admin/comercios/pedidos/${id}/entregar`, apiKey, {
      method: 'POST',
      body: JSON.stringify({ foto_entrega_url: fotoUrl, entregas }),
    })
    await alertarSiFallo(res)
    await fetchData()
    await refreshDetalle(id)
    setUpdatingId(null)
  }

  async function setComisionManual(id: number, body: { porcentaje?: number; monto?: number; automatica?: boolean }) {
    setUpdatingId(id)
    await apiFetch(`/admin/comercios/pedidos/${id}/comision-manual`, apiKey, {
      method: 'PATCH',
      body: JSON.stringify(body),
    })
    await fetchData()
    await refreshDetalle(id)
    setUpdatingId(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos comercios</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} pedidos</p>
        </div>
      </div>

      {sinVenta && (sinVenta.a_generar.length > 0 || sinVenta.sin_vendedor.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[16rem]">
            {sinVenta.a_generar.length > 0 && (
              <p>
                Hay <strong>{sinVenta.a_generar.length}</strong> pedidos anteriores que todavía no figuran en Ventas.
              </p>
            )}
            {sinVenta.sin_vendedor.length > 0 && (
              <p className="text-xs mt-0.5">
                {sinVenta.sin_vendedor.length} pedidos no pueden pasar a Ventas porque su comercio no tiene vendedor asignado
                ({sinVenta.sin_vendedor.map(p => `#${p.pedido_id}`).join(', ')}).
              </p>
            )}
          </div>
          {sinVenta.a_generar.length > 0 && (
            <button
              onClick={generarVentas}
              disabled={generando}
              className="bg-amber-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-amber-700 disabled:opacity-50"
            >
              {generando ? 'Generando...' : 'Generar ventas'}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <select
          value={filtroEstado}
          onChange={e => setFiltroEstado(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : pedidos.length === 0 ? (
        <p className="text-sm text-gray-500">No hay pedidos que coincidan.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pedido</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Comercio</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendedor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Pago</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Fecha</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cambiar estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidos.map(p => {
                const estadoInfo = ESTADOS[p.estado] ?? { label: p.estado, color: 'bg-gray-100 text-gray-700' }
                const isUpdating = updatingId === p.id
                const isExpanded = expandedId === p.id
                return (
                  <>
                    <tr key={p.id} className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}>
                      <td className="px-4 py-3 text-gray-500 text-xs font-medium" onClick={() => toggleDetalle(p.id)}>
                        #{p.id}
                      </td>
                      <td className="px-4 py-3" onClick={() => toggleDetalle(p.id)}>
                        <p className="font-medium text-gray-900">{p.comercio_nombre ?? '—'}</p>
                        <p className="text-xs text-gray-400">{p.comercio_local ?? ''}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs" onClick={() => toggleDetalle(p.id)}>
                        {p.vendedor_nombre ?? '—'}
                      </td>
                      <td className="px-4 py-3" onClick={() => toggleDetalle(p.id)}>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${estadoInfo.color}`}>
                          {estadoInfo.label}
                        </span>
                        {p.venta_id != null && (
                          <Link
                            href={`/admin/ventas/${p.venta_id}`}
                            onClick={e => e.stopPropagation()}
                            className="block mt-1 text-[11px] text-blue-600 hover:underline"
                          >
                            Venta #{p.venta_id}
                          </Link>
                        )}
                        {p.venta_sin_vendedor && (
                          <p className="mt-1 text-[11px] text-amber-700">Asigná un vendedor al comercio para registrar la venta</p>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={() => toggleDetalle(p.id)}>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${p.estado_pago === 'pagado' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {p.estado_pago === 'pagado' ? `Pagado${p.metodo_pago ? ` (${p.metodo_pago})` : ''}` : 'Pendiente'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900" onClick={() => toggleDetalle(p.id)}>
                        ${p.total.toLocaleString('es-AR')}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400" onClick={() => toggleDetalle(p.id)}>
                        {p.created_at ? new Date(p.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          disabled={isUpdating}
                          value={p.estado}
                          onChange={e => cambiarEstado(p, e.target.value as EstadoPedido)}
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
                        >
                          {Object.entries(ESTADOS).map(([k, v]) => (
                            // La entrega parcial se carga con cantidades desde el panel de Entrega.
                            <option key={k} value={k} disabled={k === 'entrega_parcial' && p.estado !== 'entrega_parcial'}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                    {isExpanded && detalle && detalle.id === p.id && (
                      <tr key={`${p.id}-detail`}>
                        <td colSpan={8} className="px-4 pb-4 pt-0 bg-gray-50">
                          <div className="border border-gray-200 rounded-lg overflow-hidden mt-1">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="text-left px-3 py-2 text-gray-500">Producto</th>
                                  <th className="text-right px-3 py-2 text-gray-500">Cant.</th>
                                  <th className="text-right px-3 py-2 text-gray-500">Entregado</th>
                                  <th className="text-right px-3 py-2 text-gray-500">P. unit.</th>
                                  <th className="text-right px-3 py-2 text-gray-500">Subtotal</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 bg-white">
                                {detalle.items.map(i => (
                                  <tr key={i.id}>
                                    <td className="px-3 py-2 text-gray-800">{i.nombre_producto}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{i.cantidad}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">{i.cantidad_entregada}</td>
                                    <td className="px-3 py-2 text-right text-gray-600">${i.precio_unitario.toLocaleString('es-AR')}</td>
                                    <td className="px-3 py-2 text-right font-medium text-gray-900">${i.subtotal.toLocaleString('es-AR')}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {detalle.notas && (
                              <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500">
                                <span className="font-medium">Notas:</span> {detalle.notas}
                              </div>
                            )}
                          </div>

                          <div className="grid sm:grid-cols-3 gap-4 mt-4">
                            <PagoPanel
                              pedido={detalle}
                              disabled={isUpdating}
                              onRegistrarPago={metodo => registrarPago(p.id, metodo)}
                            />
                            <EntregaPanel
                              pedido={detalle}
                              apiKey={apiKey}
                              disabled={isUpdating}
                              onEntregar={(fotoUrl, entregas) => entregarPedido(p.id, fotoUrl, entregas)}
                            />
                            <ComisionPanel
                              pedido={detalle}
                              disabled={isUpdating}
                              onGuardar={body => setComisionManual(p.id, body)}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function PagoPanel({
  pedido,
  disabled,
  onRegistrarPago,
}: {
  pedido: PedidoDetalle
  disabled: boolean
  onRegistrarPago: (metodo: string) => void
}) {
  const [metodo, setMetodo] = useState('efectivo')

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Pago</h3>
      {pedido.estado_pago === 'pagado' ? (
        <div className="text-sm text-gray-600">
          <p>
            Pagado por <strong>{pedido.metodo_pago}</strong>
            {pedido.fecha_pago && <> el <strong>{formatFecha(pedido.fecha_pago)}</strong></>}.
          </p>
          {pedido.comision && (
            <p className="mt-1 text-xs text-gray-400">
              Comisión: ${pedido.comision.monto.toLocaleString('es-AR')} ({(pedido.comision.tasa * 100).toFixed(0)}%, {pedido.comision.estado})
            </p>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={metodo}
            onChange={e => setMetodo(e.target.value)}
            disabled={disabled}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
          >
            <option value="efectivo">Efectivo</option>
            <option value="transferencia">Transferencia</option>
          </select>
          <button
            onClick={() => onRegistrarPago(metodo)}
            disabled={disabled}
            className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            Registrar pago
          </button>
        </div>
      )}
    </div>
  )
}

function ComisionPanel({
  pedido,
  disabled,
  onGuardar,
}: {
  pedido: PedidoDetalle
  disabled: boolean
  onGuardar: (body: { porcentaje?: number; monto?: number; automatica?: boolean }) => void
}) {
  const modoInicial: 'auto' | 'porcentaje' | 'monto' =
    pedido.comision_monto_manual != null ? 'monto' : pedido.comision_porcentaje_manual != null ? 'porcentaje' : 'auto'
  const [editando, setEditando] = useState(false)
  const [modo, setModo] = useState<'auto' | 'porcentaje' | 'monto'>(modoInicial)
  const [valor, setValor] = useState(String(pedido.comision_monto_manual ?? pedido.comision_porcentaje_manual ?? ''))

  function guardar() {
    if (modo === 'auto') {
      onGuardar({ automatica: true })
    } else if (modo === 'monto') {
      onGuardar({ monto: Number(valor) })
    } else {
      onGuardar({ porcentaje: Number(valor) })
    }
    setEditando(false)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Comisión</h3>
      {pedido.comision ? (
        <p className="text-sm text-gray-600">
          ${pedido.comision.monto.toLocaleString('es-AR')} ({(pedido.comision.tasa * 100).toFixed(1)}%, {pedido.comision.estado})
        </p>
      ) : (
        <p className="text-sm text-gray-400">
          {pedido.estado_pago === 'pagado' ? 'Sin vendedor asignado a la cartera.' : 'Se genera al registrar el pago.'}
        </p>
      )}

      {!editando ? (
        <button
          onClick={() => setEditando(true)}
          disabled={disabled}
          className="mt-2 text-xs font-medium text-primary-600 hover:underline disabled:opacity-50"
        >
          {pedido.comision_monto_manual != null || pedido.comision_porcentaje_manual != null ? 'Editar override manual' : 'Cargar override manual'}
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden text-xs">
            {(['auto', 'porcentaje', 'monto'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setModo(m)}
                className={`px-2.5 py-1 ${modo === m ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                {m === 'auto' ? 'Automática' : m === 'porcentaje' ? '%' : '$'}
              </button>
            ))}
          </div>
          {modo !== 'auto' && (
            <input
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={e => setValor(e.target.value)}
              className="w-28 border border-gray-300 rounded px-2 py-1 text-sm"
            />
          )}
          <div className="flex gap-2">
            <button
              onClick={guardar}
              disabled={disabled || (modo !== 'auto' && !valor)}
              className="text-xs font-medium bg-gray-900 text-white rounded px-3 py-1.5 hover:bg-gray-800 disabled:opacity-50"
            >
              Guardar
            </button>
            <button onClick={() => setEditando(false)} className="text-xs text-gray-500 hover:underline">
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function EntregaPanel({
  pedido,
  apiKey,
  disabled,
  onEntregar,
}: {
  pedido: PedidoDetalle
  apiKey: string
  disabled: boolean
  onEntregar: (fotoUrl: string, entregas: Record<number, number>) => void
}) {
  const [cantidades, setCantidades] = useState<Record<number, number>>(() =>
    Object.fromEntries(pedido.items.map(i => [i.id, i.cantidad]))
  )
  const [fotoUrl, setFotoUrl] = useState(pedido.foto_entrega_url ?? '')
  const [uploading, setUploading] = useState(false)
  const yaEntregado = pedido.estado === 'entregado'

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const [url] = await uploadImages(apiKey, [file])
      setFotoUrl(url)
    } catch {
      // el fetch ya deja fotoUrl vacío; el botón de entregar queda deshabilitado
    }
    setUploading(false)
  }

  function handleSubmit() {
    onEntregar(fotoUrl, cantidades)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Entrega</h3>

      {pedido.entregas.length > 0 && (
        <ul className="mb-3 space-y-2 border-b border-gray-100 pb-3">
          {pedido.entregas.map(e => (
            <li key={e.id} className="flex items-start gap-2 text-xs">
              {e.foto_url ? (
                <a href={resolveImageUrl(e.foto_url) ?? e.foto_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  <img src={resolveImageUrl(e.foto_url) ?? e.foto_url} alt={`Foto de la entrega del ${formatFecha(e.fecha)}`} className="h-9 w-9 object-cover rounded border border-gray-200" />
                </a>
              ) : (
                <div className="h-9 w-9 shrink-0 rounded border border-dashed border-gray-300" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-gray-700">
                  {formatFecha(e.fecha)}
                  <span className="font-normal text-gray-400">
                    {e.origen === 'vendedor' ? ' · vendedor' : e.origen === 'migracion' ? ' · fecha aproximada' : ''}
                  </span>
                </p>
                <p className="text-gray-500">
                  {e.items.map(i => `${i.cantidad} × ${i.nombre_producto ?? 'producto'}`).join(', ')}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2 mb-3">
        {pedido.items.map(item => (
          <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="text-gray-600 truncate">{item.nombre_producto}</span>
            <input
              type="number"
              min={0}
              max={item.cantidad}
              value={cantidades[item.id] ?? item.cantidad_entregada}
              onChange={e => setCantidades(c => ({ ...c, [item.id]: parseInt(e.target.value) || 0 }))}
              disabled={disabled}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-right focus:outline-none focus:ring-1 focus:ring-gray-300 disabled:opacity-50"
            />
            <span className="text-gray-400">/ {item.cantidad}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        {fotoUrl ? (
          <img src={resolveImageUrl(fotoUrl) ?? fotoUrl} alt="Foto de entrega" className="h-14 w-14 object-cover rounded-lg border border-gray-200" />
        ) : (
          <div className="h-14 w-14 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
            Sin foto
          </div>
        )}
        <label className="text-xs font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50">
          {uploading ? 'Subiendo...' : 'Subir foto'}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={disabled || uploading}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleFile(file)
            }}
          />
        </label>
      </div>

      <button
        onClick={handleSubmit}
        disabled={disabled || uploading || !fotoUrl}
        className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-50"
      >
        {yaEntregado ? 'Actualizar entrega' : 'Confirmar entrega'}
      </button>
      {!fotoUrl && <p className="text-[11px] text-gray-400 mt-1.5">La foto de entrega es obligatoria.</p>}
    </div>
  )
}
