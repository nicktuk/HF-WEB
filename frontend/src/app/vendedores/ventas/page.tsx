'use client'

import { useEffect, useState } from 'react'
import { Store, ShoppingBag } from 'lucide-react'
import { VendedorHeader } from '../_components/VendedorHeader'
import { Modal, ModalContent } from '@/components/ui/modal'

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
  pendiente: 'bg-zinc-100 text-zinc-600',
  parcial: 'bg-amber-100 text-amber-700',
  completo: 'bg-emerald-100 text-emerald-700',
}

type Familia = 'zinc' | 'blue' | 'amber' | 'emerald' | 'red'

const CARD_POR_FAMILIA: Record<Familia, string> = {
  zinc: 'bg-white border-zinc-300',
  blue: 'bg-blue-50 border-blue-300',
  amber: 'bg-amber-50 border-amber-300',
  emerald: 'bg-emerald-50 border-emerald-300',
  red: 'bg-red-50 border-red-300',
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
  return 'zinc'
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

function Tarjeta({ item, onClick }: { item: VentaItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left border-2 shadow-sm rounded-xl p-3 hover:shadow-md hover:brightness-95 transition-all ${CARD_POR_FAMILIA[familiaDe(item)]}`}
    >
      <p className="font-medium text-zinc-800 text-sm truncate">{item.cliente_nombre ?? `#${item.id}`}</p>
      <p className="text-xs text-zinc-500 mb-2">${item.total.toLocaleString('es-AR')} · {fechaCorta(item.created_at)}</p>
      <div className="flex flex-wrap gap-1.5">
        {item.canal === 'mayorista' ? (
          <>
            <Badge label={LABEL_ESTADO_PEDIDO[item.estado ?? ''] ?? item.estado ?? ''} color={COLOR_ESTADO_PEDIDO[item.estado ?? ''] ?? 'bg-zinc-100 text-zinc-600'} />
            {!item.cancelado && (
              <Badge label={LABEL_PAGO[item.pago_estado]} color={COLOR_POR_ESTADO_GENERICO[item.pago_estado]} />
            )}
          </>
        ) : (
          <>
            <Badge label={LABEL_ENTREGA[item.entrega_estado]} color={COLOR_POR_ESTADO_GENERICO[item.entrega_estado]} />
            <Badge label={LABEL_PAGO[item.pago_estado]} color={COLOR_POR_ESTADO_GENERICO[item.pago_estado]} />
          </>
        )}
      </div>
    </button>
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
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-zinc-100">
          <Icon className="h-4 w-4 text-zinc-600" />
        </div>
        <h2 className="text-sm font-semibold text-zinc-700 flex-1">{titulo}</h2>
        <span className="text-xs font-medium text-zinc-400 bg-zinc-100 rounded-full px-2 py-0.5">{items.length}</span>
      </div>
      <div className="p-4 bg-zinc-50">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">No tenés ventas en este canal todavía.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map(item => (
              <Tarjeta key={item.id} item={item} onClick={() => onClickItem(item)} />
            ))}
          </div>
        )}
      </div>
    </section>
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

  useEffect(() => {
    Promise.all([
      fetch('/api/vendedores/info').then(res => (res.ok ? res.json() : null)),
      fetch('/api/vendedores/mis-ventas').then(res => (res.ok ? res.json() : null)),
    ]).then(([infoData, ventasData]) => {
      setInfo(infoData)
      setVentas(ventasData?.ventas ?? [])
    })
  }, [])

  function abrirHistorial(item: VentaItem) {
    setSeleccion(item)
    setHistorial(null)
    fetch(`/api/vendedores/mis-ventas/${item.canal}/${item.id}/historial`)
      .then(res => (res.ok ? res.json() : []))
      .then(setHistorial)
  }

  const mayoristas = ventas?.filter(v => v.canal === 'mayorista') ?? []
  const minoristas = ventas?.filter(v => v.canal === 'minorista') ?? []

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader nombre={info?.nombre} />

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mis ventas</h1>
          <p className="text-sm text-zinc-500">Tocá una para ver cuándo pasó por cada etapa.</p>
        </div>

        {ventas === null ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <SeccionCanal icon={Store} titulo="Pedidos mayoristas" items={mayoristas} onClickItem={abrirHistorial} />
            <SeccionCanal icon={ShoppingBag} titulo="Ventas minoristas" items={minoristas} onClickItem={abrirHistorial} />
          </>
        )}
      </div>

      <Modal
        isOpen={seleccion !== null}
        onClose={() => setSeleccion(null)}
        title={seleccion?.cliente_nombre ?? (seleccion ? `#${seleccion.id}` : '')}
        size="sm"
      >
        <ModalContent>
          {historial === null ? (
            <p className="text-sm text-zinc-400">Cargando...</p>
          ) : (
            <Timeline puntos={historial} />
          )}
        </ModalContent>
      </Modal>
    </main>
  )
}
