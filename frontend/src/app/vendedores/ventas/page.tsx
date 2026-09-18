'use client'

import { useEffect, useState } from 'react'
import { Store, ShoppingBag } from 'lucide-react'
import { VendedorHeader } from '../_components/VendedorHeader'
import { Modal, ModalContent } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'

interface VendedorInfo {
  id: number
  nombre: string
}

interface VentaItem {
  canal: 'mayorista' | 'minorista'
  id: number
  cliente_nombre: string | null
  estado: string | null
  cancelado: boolean
  entrega_estado: 'pendiente' | 'parcial' | 'completo'
  pago_estado: 'pendiente' | 'parcial' | 'completo'
  total: number
  created_at: string
}

interface PuntoHistorial {
  estado: string
  fecha: string
}

interface VentaDetalleItem {
  id: number
  nombre: string | null
  cantidad: number
  cantidad_entregada: number
  entregado: boolean
  pagado?: boolean
  precio_unitario: number
  subtotal: number
}

interface VentaDetalle {
  cancelado: boolean
  pago_estado: 'pendiente' | 'parcial' | 'completo'
  pago_por_item: boolean
  items: VentaDetalleItem[]
}

const LABEL_ESTADO_PEDIDO: Record<string, string> = {
  recibido: 'Recibido',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  entrega_parcial: 'Entrega parcial',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

const LABEL_HISTORIAL: Record<string, string> = {
  ...LABEL_ESTADO_PEDIDO,
  pendiente_pago: 'Pendiente de pago',
  pagada: 'Pagada',
  entregada: 'Entregada',
}

const COLOR_ESTADO_PEDIDO: Record<string, string> = {
  recibido: 'bg-zinc-100 text-zinc-600',
  confirmado: 'bg-blue-100 text-blue-700',
  preparando: 'bg-amber-100 text-amber-700',
  entrega_parcial: 'bg-amber-100 text-amber-700',
  entregado: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-red-100 text-red-700',
}

const LABEL_ENTREGA: Record<string, string> = {
  pendiente: 'Sin entregar',
  parcial: 'Entrega parcial',
  completo: 'Entregado',
}

const LABEL_PAGO: Record<string, string> = {
  pendiente: 'Sin pagar',
  parcial: 'Pago parcial',
  completo: 'Pagado',
}

const COLOR_POR_ESTADO_GENERICO: Record<string, string> = {
  pendiente: 'bg-red-100 text-red-700',
  parcial: 'bg-amber-100 text-amber-700',
  completo: 'bg-emerald-100 text-emerald-700',
}

type Familia = 'zinc' | 'blue' | 'amber' | 'emerald' | 'red'

const BARRA_POR_FAMILIA: Record<Familia, string> = {
  zinc: 'bg-zinc-300',
  blue: 'bg-blue-400',
  amber: 'bg-amber-400',
  emerald: 'bg-emerald-400',
  red: 'bg-red-400',
}

const FAMILIA_POR_ESTADO_PEDIDO: Record<string, Familia> = {
  recibido: 'zinc',
  confirmado: 'blue',
  preparando: 'amber',
  entrega_parcial: 'amber',
  entregado: 'emerald',
  cancelado: 'red',
}

function familiaDe(item: VentaItem): Familia {
  if (item.canal === 'mayorista') {
    return FAMILIA_POR_ESTADO_PEDIDO[item.estado ?? ''] ?? 'zinc'
  }
  if (item.entrega_estado === 'completo') return 'emerald'
  if (item.entrega_estado === 'parcial' || item.pago_estado !== 'pendiente') return 'amber'
  return 'red'
}

function pendienteDeAccion(item: VentaItem): boolean {
  if (item.canal === 'mayorista') {
    return !item.cancelado && (item.entrega_estado !== 'completo' || item.pago_estado !== 'completo')
  }
  return item.entrega_estado !== 'completo' || item.pago_estado !== 'completo'
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function Badge({ label, color }: { label: string; color: string }) {
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${color}`}>{label}</span>
}

function StatTile({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <div className="bg-white rounded-2xl vendedor-card p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{valor}</p>
    </div>
  )
}

function FilaVenta({ item, onClick }: { item: VentaItem; onClick: () => void }) {
  return (
    <tr onClick={onClick} className="cursor-pointer hover:bg-zinc-50 transition-colors">
      <td className="py-2 pl-2 pr-2">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${BARRA_POR_FAMILIA[familiaDe(item)]}`} />
      </td>
      <td className="py-2 pr-2 text-zinc-400">#{item.id}</td>
      <td className="py-2 pr-2 font-medium text-zinc-800 truncate max-w-[180px]">{item.cliente_nombre ?? '—'}</td>
      <td className="py-2 pr-2 text-zinc-600 whitespace-nowrap">${item.total.toLocaleString('es-AR')}</td>
      <td className="py-2 pr-2 text-zinc-500 whitespace-nowrap">{fechaCorta(item.created_at)}</td>
      <td className="py-2 pr-2">
        {item.canal === 'mayorista' ? (
          <Badge label={LABEL_ESTADO_PEDIDO[item.estado ?? ''] ?? item.estado ?? ''} color={COLOR_ESTADO_PEDIDO[item.estado ?? ''] ?? 'bg-zinc-100 text-zinc-600'} />
        ) : (
          <Badge label={LABEL_ENTREGA[item.entrega_estado]} color={COLOR_POR_ESTADO_GENERICO[item.entrega_estado]} />
        )}
      </td>
      <td className="py-2 pr-2">
        {(item.canal === 'minorista' || !item.cancelado) && (
          <Badge label={LABEL_PAGO[item.pago_estado]} color={COLOR_POR_ESTADO_GENERICO[item.pago_estado]} />
        )}
      </td>
    </tr>
  )
}

function SeccionCanal({
  icon: Icon, titulo, items, onClickItem,
}: {
  icon: React.ElementType
  titulo: string
  items: VentaItem[]
  onClickItem: (item: VentaItem) => void
}) {
  return (
    <section className="bg-white rounded-2xl vendedor-card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-zinc-100">
          <Icon className="h-4 w-4 text-zinc-600" />
        </div>
        <h2 className="text-sm font-semibold text-zinc-700 flex-1">{titulo}</h2>
        <span className="text-xs font-medium text-zinc-400 bg-zinc-100 rounded-full px-2 py-0.5">{items.length}</span>
      </div>
      <div className="p-4">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">No tenés ventas en este canal todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="pl-2" />
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">#</th>
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Cliente</th>
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Total</th>
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Fecha</th>
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Estado</th>
                  <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {items.map(item => (
                  <FilaVenta key={item.id} item={item} onClick={() => onClickItem(item)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

function PanelProductos({
  detalle, accionando, onEntregarItem, onPagarItem, onPagarPedido,
}: {
  detalle: VentaDetalle
  accionando: string | null
  onEntregarItem: (itemId: number) => void
  onPagarItem: (itemId: number) => void
  onPagarPedido: () => void
}) {
  if (detalle.cancelado) {
    return <p className="text-sm text-zinc-400">Este pedido está cancelado.</p>
  }

  return (
    <div className="space-y-3">
      {!detalle.pago_por_item && (
        <div className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2">
          <div>
            <p className="text-sm font-medium text-zinc-700">Pago del pedido</p>
            <Badge label={LABEL_PAGO[detalle.pago_estado]} color={COLOR_POR_ESTADO_GENERICO[detalle.pago_estado]} />
          </div>
          {detalle.pago_estado !== 'completo' && (
            <Button size="sm" onClick={onPagarPedido} isLoading={accionando === 'pagar-pedido'} disabled={accionando !== null}>
              Pagado
            </Button>
          )}
        </div>
      )}

      <ul className="divide-y divide-zinc-100">
        {detalle.items.map(item => (
          <li key={item.id} className="py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-800 truncate">{item.nombre ?? '—'}</p>
              <p className="text-xs text-zinc-500">
                {item.cantidad_entregada}/{item.cantidad} entregado · ${item.subtotal.toLocaleString('es-AR')}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {item.entregado ? (
                <Badge label="Entregado" color={COLOR_POR_ESTADO_GENERICO.completo} />
              ) : (
                <Button
                  size="sm" variant="outline"
                  onClick={() => onEntregarItem(item.id)}
                  isLoading={accionando === `entregar-${item.id}`}
                  disabled={accionando !== null}
                >
                  Entregado
                </Button>
              )}
              {detalle.pago_por_item && (
                item.pagado ? (
                  <Badge label="Pagado" color={COLOR_POR_ESTADO_GENERICO.completo} />
                ) : (
                  <Button
                    size="sm" variant="outline"
                    onClick={() => onPagarItem(item.id)}
                    isLoading={accionando === `pagar-${item.id}`}
                    disabled={accionando !== null}
                  >
                    Pagado
                  </Button>
                )
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Timeline({ puntos }: { puntos: PuntoHistorial[] }) {
  return (
    <div className="space-y-0">
      {puntos.map((p, i) => (
        <div key={i} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${i === puntos.length - 1 ? 'bg-primary-600' : 'bg-zinc-300'}`} />
            {i < puntos.length - 1 && <div className="w-px flex-1 bg-zinc-200 my-0.5" />}
          </div>
          <div className="pb-4 min-w-0">
            <p className="text-sm font-medium text-zinc-800">{LABEL_HISTORIAL[p.estado] ?? p.estado}</p>
            <p className="text-xs text-zinc-500">{fechaLarga(p.fecha)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function MisVentasPage() {
  const [info, setInfo] = useState<VendedorInfo | null>(null)
  const [ventas, setVentas] = useState<VentaItem[] | null>(null)
  const [seleccion, setSeleccion] = useState<VentaItem | null>(null)
  const [historial, setHistorial] = useState<PuntoHistorial[] | null>(null)
  const [detalle, setDetalle] = useState<VentaDetalle | null>(null)
  const [tab, setTab] = useState<'productos' | 'historial'>('productos')
  const [accionando, setAccionando] = useState<string | null>(null)

  function recargarVentas() {
    return fetch('/api/vendedores/mis-ventas')
      .then(res => (res.ok ? res.json() : null))
      .then(data => setVentas(data?.ventas ?? []))
  }

  useEffect(() => {
    Promise.all([
      fetch('/api/vendedores/info').then(res => (res.ok ? res.json() : null)),
      fetch('/api/vendedores/mis-ventas').then(res => (res.ok ? res.json() : null)),
    ]).then(([infoData, ventasData]) => {
      setInfo(infoData)
      setVentas(ventasData?.ventas ?? [])
    })
  }, [])

  function fetchDetalle(item: VentaItem) {
    return fetch(`/api/vendedores/mis-ventas/${item.canal}/${item.id}/detalle`)
      .then(res => (res.ok ? res.json() : null))
      .then(setDetalle)
  }

  function abrirVenta(item: VentaItem) {
    setSeleccion(item)
    setTab('productos')
    setHistorial(null)
    setDetalle(null)
    fetchDetalle(item)
    fetch(`/api/vendedores/mis-ventas/${item.canal}/${item.id}/historial`)
      .then(res => (res.ok ? res.json() : []))
      .then(setHistorial)
  }

  async function ejecutarAccion(accionKey: string, url: string) {
    if (!seleccion) return
    setAccionando(accionKey)
    try {
      await fetch(url, { method: 'POST' })
      await Promise.all([fetchDetalle(seleccion), recargarVentas()])
    } finally {
      setAccionando(null)
    }
  }

  function entregarItem(itemId: number) {
    if (!seleccion) return
    ejecutarAccion(`entregar-${itemId}`, `/api/vendedores/mis-ventas/${seleccion.canal}/${seleccion.id}/items/${itemId}/entregar`)
  }

  function pagarItem(itemId: number) {
    if (!seleccion) return
    ejecutarAccion(`pagar-${itemId}`, `/api/vendedores/mis-ventas/minorista/${seleccion.id}/items/${itemId}/pagar`)
  }

  function pagarPedido() {
    if (!seleccion) return
    ejecutarAccion('pagar-pedido', `/api/vendedores/mis-ventas/mayorista/${seleccion.id}/pagar`)
  }

  const mayoristas = ventas?.filter(v => v.canal === 'mayorista') ?? []
  const minoristas = ventas?.filter(v => v.canal === 'minorista') ?? []
  const pendientes = ventas?.filter(pendienteDeAccion).length ?? 0
  const cancelados = mayoristas.filter(v => v.cancelado).length

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader nombre={info?.nombre} />

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mis ventas</h1>
          <p className="text-sm text-zinc-500">Tocá una para ver cuándo pasó por cada etapa.</p>
        </div>

        {ventas === null ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatTile label="Pedidos mayoristas" valor={mayoristas.length} color="text-zinc-800" />
              <StatTile label="Ventas minoristas" valor={minoristas.length} color="text-zinc-800" />
              <StatTile label="Pendientes de acción" valor={pendientes} color="text-amber-600" />
              <StatTile label="Cancelados" valor={cancelados} color="text-red-600" />
            </div>

            <SeccionCanal icon={Store} titulo="Pedidos mayoristas" items={mayoristas} onClickItem={abrirVenta} />
            <SeccionCanal icon={ShoppingBag} titulo="Ventas minoristas" items={minoristas} onClickItem={abrirVenta} />
          </>
        )}
      </div>

      <Modal
        isOpen={seleccion !== null}
        onClose={() => setSeleccion(null)}
        title={seleccion ? `${seleccion.cliente_nombre ?? 'Venta'} · #${seleccion.id}` : ''}
        size="sm"
      >
        <ModalContent>
          <div className="flex gap-4 border-b border-zinc-100 mb-4">
            <button
              className={`pb-2 text-sm font-medium border-b-2 -mb-px ${tab === 'productos' ? 'border-primary-600 text-primary-700' : 'border-transparent text-zinc-400'}`}
              onClick={() => setTab('productos')}
            >
              Productos
            </button>
            <button
              className={`pb-2 text-sm font-medium border-b-2 -mb-px ${tab === 'historial' ? 'border-primary-600 text-primary-700' : 'border-transparent text-zinc-400'}`}
              onClick={() => setTab('historial')}
            >
              Historial
            </button>
          </div>

          {tab === 'productos' ? (
            detalle === null ? (
              <p className="text-sm text-zinc-400">Cargando...</p>
            ) : (
              <PanelProductos
                detalle={detalle}
                accionando={accionando}
                onEntregarItem={entregarItem}
                onPagarItem={pagarItem}
                onPagarPedido={pagarPedido}
              />
            )
          ) : historial === null ? (
            <p className="text-sm text-zinc-400">Cargando...</p>
          ) : (
            <Timeline puntos={historial} />
          )}
        </ModalContent>
      </Modal>
    </main>
  )
}
