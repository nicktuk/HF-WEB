'use client'

import { useEffect, useRef, useState } from 'react'
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

// Minorista no tiene un único campo "estado" (tiene entrega + pago por
// separado) — para poder agruparla igual que a mayorista, se sintetiza un
// estado combinado de 3 valores.
type EstadoMinorista = 'pendiente' | 'en_proceso' | 'completo'

const ORDEN_ESTADO_MAYORISTA = ['recibido', 'confirmado', 'preparando', 'entrega_parcial', 'entregado', 'cancelado']
const ORDEN_ESTADO_MINORISTA: EstadoMinorista[] = ['pendiente', 'en_proceso', 'completo']

const LABEL_ESTADO_MINORISTA: Record<EstadoMinorista, string> = {
  pendiente: 'Sin iniciar',
  en_proceso: 'En proceso',
  completo: 'Completa',
}

const COLOR_ESTADO_MINORISTA: Record<EstadoMinorista, string> = {
  pendiente: 'bg-zinc-100 text-zinc-600',
  en_proceso: 'bg-amber-100 text-amber-700',
  completo: 'bg-emerald-100 text-emerald-700',
}

function estadoMinoristaDe(item: VentaItem): EstadoMinorista {
  if (item.entrega_estado === 'completo' && item.pago_estado === 'completo') return 'completo'
  if (item.entrega_estado === 'pendiente' && item.pago_estado === 'pendiente') return 'pendiente'
  return 'en_proceso'
}

function estadoKeyDe(item: VentaItem): string {
  return item.canal === 'mayorista' ? (item.estado ?? '') : estadoMinoristaDe(item)
}

function estadoLabelDe(canal: 'mayorista' | 'minorista', key: string): string {
  return canal === 'mayorista' ? (LABEL_ESTADO_PEDIDO[key] ?? key) : LABEL_ESTADO_MINORISTA[key as EstadoMinorista]
}

function estadoColorDe(canal: 'mayorista' | 'minorista', key: string): string {
  return canal === 'mayorista' ? (COLOR_ESTADO_PEDIDO[key] ?? 'bg-zinc-100 text-zinc-600') : COLOR_ESTADO_MINORISTA[key as EstadoMinorista]
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
  return 'zinc'
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
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
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

function GrupoEstadoCards({
  canal, items, activo, onSelect,
}: {
  canal: 'mayorista' | 'minorista'
  items: VentaItem[]
  activo: string | null
  onSelect: (estado: string) => void
}) {
  const orden = canal === 'mayorista' ? ORDEN_ESTADO_MAYORISTA : ORDEN_ESTADO_MINORISTA
  const counts = new Map<string, number>()
  for (const item of items) {
    const key = estadoKeyDe(item)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const grupos = orden.filter(key => (counts.get(key) ?? 0) > 0)
  if (grupos.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2 mb-3">
      {grupos.map(key => {
        const seleccionado = activo === key
        return (
          <button
            key={key}
            onClick={() => onSelect(key)}
            className={`text-left rounded-xl border px-3 py-2 transition-colors ${
              seleccionado ? 'border-primary-400 bg-primary-50' : 'border-zinc-200 bg-white hover:border-zinc-300'
            }`}
          >
            <Badge label={estadoLabelDe(canal, key)} color={estadoColorDe(canal, key)} />
            <p className="text-lg font-bold text-zinc-800 mt-1">{counts.get(key)}</p>
          </button>
        )
      })}
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
  const [filtro, setFiltro] = useState<string | null>(null)
  const tablaRef = useRef<HTMLDivElement>(null)

  function seleccionarGrupo(estado: string) {
    setFiltro(prev => (prev === estado ? null : estado))
    // Las tarjetas de arriba te llevan a la grilla filtrada de abajo.
    tablaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }

  const itemsFiltrados = filtro === null ? items : items.filter(item => estadoKeyDe(item) === filtro)

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 overflow-hidden">
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
          <>
            <GrupoEstadoCards canal={canal} items={items} activo={filtro} onSelect={seleccionarGrupo} />
            <div ref={tablaRef} className="overflow-x-auto scroll-mt-4">
              {filtro !== null && itemsFiltrados.length === 0 ? (
                <p className="text-sm text-zinc-400 py-2">Nada en este estado.</p>
              ) : (
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
                    {itemsFiltrados.map(item => (
                      <FilaVenta key={item.id} item={item} onClick={() => onClickItem(item)} />
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
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

            <SeccionCanal icon={Store} titulo="Pedidos mayoristas" canal="mayorista" items={mayoristas} onClickItem={abrirHistorial} />
            <SeccionCanal icon={ShoppingBag} titulo="Ventas minoristas" canal="minorista" items={minoristas} onClickItem={abrirHistorial} />
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
