import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { mayoristFetch } from '@/lib/comercio-fetch'
import { ComercioHeader } from '../../_components/ComercioHeader'

export const metadata = { robots: 'noindex, nofollow' }

const ESTADOS: Record<string, { label: string; color: string }> = {
  recibido:   { label: 'Recibido',       color: 'bg-blue-100 text-blue-700' },
  confirmado: { label: 'Confirmado',     color: 'bg-indigo-100 text-indigo-700' },
  preparando: { label: 'En preparación', color: 'bg-yellow-100 text-yellow-700' },
  entregado:  { label: 'Entregado',      color: 'bg-green-100 text-green-700' },
  cancelado:  { label: 'Cancelado',      color: 'bg-red-100 text-red-700' },
}

export default async function PedidoDetailPage({ params }: { params: { id: string } }) {
  const [pedidoRes, infoRes] = await Promise.all([
    mayoristFetch(`/pedidos/${params.id}`),
    mayoristFetch('/info'),
  ])

  if (pedidoRes.status === 404) notFound()
  if (!pedidoRes.ok || !infoRes.ok) redirect('/comercios')

  const pedido = await pedidoRes.json() as {
    id: number; estado: string; total: number; notas: string | null; created_at: string;
    items: { id: number; nombre_producto: string; cantidad: number; precio_unitario: number; precio_original: number | null; subtotal: number }[]
  }
  const info = await infoRes.json()

  const estadoInfo = ESTADOS[pedido.estado] ?? { label: pedido.estado, color: 'bg-gray-100 text-gray-700' }

  return (
    <div className="min-h-screen bg-gray-50">
      <ComercioHeader nombreLocal={info.nombre_local} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/comercios/pedidos" className="text-sm text-gray-500 hover:underline">
            ← Mis pedidos
          </Link>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-bold text-gray-800">Pedido #{pedido.id}</h1>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(pedido.created_at).toLocaleDateString('es-AR', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </p>
            </div>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${estadoInfo.color}`}>
              {estadoInfo.label}
            </span>
          </div>

          {pedido.estado === 'recibido' && (
            <p className="text-sm text-gray-600 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              Pedido recibido. Tu vendedor se va a contactar para coordinar pago y entrega.
            </p>
          )}

          <div className="divide-y divide-gray-100">
            {pedido.items.map(item => (
              <div key={item.id} className="py-3 flex justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800">{item.nombre_producto}</p>
                  <p className="text-xs text-gray-400">
                    {item.cantidad} u. × ${item.precio_unitario.toLocaleString('es-AR')}
                    {item.precio_original && item.precio_original !== item.precio_unitario && (
                      <span className="ml-1 line-through text-gray-300">
                        ${item.precio_original.toLocaleString('es-AR')}
                      </span>
                    )}
                  </p>
                </div>
                <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
                  ${item.subtotal.toLocaleString('es-AR')}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-gray-100">
            <span className="text-sm font-medium text-gray-700">Total</span>
            <span className="text-lg font-bold text-gray-900">
              ${pedido.total.toLocaleString('es-AR')}
            </span>
          </div>

          {pedido.notas && (
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg px-4 py-3">
              <span className="font-medium">Notas: </span>{pedido.notas}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
