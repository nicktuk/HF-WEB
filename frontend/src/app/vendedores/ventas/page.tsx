'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Store, ShoppingBag } from 'lucide-react'
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
  estado: string
  total: number
  created_at: string
}

interface PuntoHistorial {
  estado: string
  fecha: string
}

const ORDEN_ESTADO: Record<'mayorista' | 'minorista', string[]> = {
  mayorista: ['recibido', 'confirmado', 'preparando', 'entrega_parcial', 'entregado', 'cancelado'],
  minorista: ['pendiente_pago', 'pagada', 'entregada'],
}

const LABEL_ESTADO: Record<string, string> = {
  recibido: 'Recibido',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  entrega_parcial: 'Entrega parcial',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
  pendiente_pago: 'Pendiente de pago',
  pagada: 'Pagada',
  entregada: 'Entregada',
}

const COLOR_ESTADO: Record<string, string> = {
  recibido: 'bg-zinc-100 text-zinc-600',
  confirmado: 'bg-blue-100 text-blue-700',
  preparando: 'bg-amber-100 text-amber-700',
  entrega_parcial: 'bg-amber-100 text-amber-700',
  entregado: 'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-red-100 text-red-700',
  pendiente_pago: 'bg-zinc-100 text-zinc-600',
  pagada: 'bg-blue-100 text-blue-700',
  entregada: 'bg-emerald-100 text-emerald-700',
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function GrupoEstado({
  canal, estado, items, onClickItem,
}: {
  canal: 'mayorista' | 'minorista'
  estado: string
  items: VentaItem[]
  onClickItem: (item: VentaItem) => void
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="border border-zinc-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setAbierto(a => !a)}
        className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-zinc-50 transition-colors"
      >
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLOR_ESTADO[estado] ?? 'bg-zinc-100 text-zinc-600'}`}>
          {LABEL_ESTADO[estado] ?? estado}
        </span>
        <span className="text-xs text-zinc-400 flex-1 text-right pr-2">{items.length} venta{items.length === 1 ? '' : 's'}</span>
        {abierto ? <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0" />}
      </button>
      {abierto && (
        <div className="grid gap-2 sm:grid-cols-2 p-3 pt-0">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => onClickItem(item)}
              className="text-left border border-zinc-100 rounded-xl p-3 hover:border-zinc-300 hover:bg-zinc-50 transition-colors"
            >
              <p className="font-medium text-zinc-800 text-sm truncate">{item.cliente_nombre ?? `#${item.id}`}</p>
              <p className="text-xs text-zinc-500">${item.total.toLocaleString('es-AR')} · {fechaCorta(item.created_at)}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SeccionCanal({
  icon: Icon, titulo, canal, items, onClickItem,
}: {
  icon: React.ElementType
  titulo: string
  canal: 'mayorista' | 'minorista'
  items: VentaItem[]
  onClickItem: (item: VentaItem) => void
}) {
  const porEstado = new Map<string, VentaItem[]>()
  for (const item of items) {
    const lista = porEstado.get(item.estado) ?? []
    lista.push(item)
    porEstado.set(item.estado, lista)
  }
  const estadosOrdenados = [
    ...ORDEN_ESTADO[canal].filter(e => porEstado.has(e)),
    ...Array.from(porEstado.keys()).filter(e => !ORDEN_ESTADO[canal].includes(e)),
  ]

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-zinc-100">
          <Icon className="h-4 w-4 text-zinc-600" />
        </div>
        <h2 className="text-sm font-semibold text-zinc-700 flex-1">{titulo}</h2>
        <span className="text-xs font-medium text-zinc-400 bg-zinc-100 rounded-full px-2 py-0.5">{items.length}</span>
      </div>
      <div className="p-4 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">No tenés ventas en este canal todavía.</p>
        ) : (
          estadosOrdenados.map(estado => (
            <GrupoEstado key={estado} canal={canal} estado={estado} items={porEstado.get(estado)!} onClickItem={onClickItem} />
          ))
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
            <p className="text-sm font-medium text-zinc-800">{LABEL_ESTADO[p.estado] ?? p.estado}</p>
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

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mis ventas</h1>
          <p className="text-sm text-zinc-500">Agrupadas por estado. Tocá una para ver cuándo pasó por cada etapa.</p>
        </div>

        {ventas === null ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <SeccionCanal icon={Store} titulo="Pedidos mayoristas" canal="mayorista" items={mayoristas} onClickItem={abrirHistorial} />
            <SeccionCanal icon={ShoppingBag} titulo="Ventas minoristas" canal="minorista" items={minoristas} onClickItem={abrirHistorial} />
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
