import { redirect } from 'next/navigation'
import Link from 'next/link'
import { mayoristFetch } from '@/lib/comercio-fetch'
import { ComercioHeader } from '../_components/ComercioHeader'

export const metadata = { robots: 'noindex, nofollow' }

const ESTADOS: Record<string, string> = {
  recibido: 'Recibido',
  confirmado: 'Confirmado',
  preparando: 'En preparación',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
}

export default async function PedidosPage() {
  const [pedidosRes, infoRes] = await Promise.all([
    mayoristFetch('/pedidos'),
    mayoristFetch('/info'),
  ])
  if (!pedidosRes.ok || !infoRes.ok) redirect('/comercios')

  const pedidos = await pedidosRes.json() as {
    id: number; estado: string; total: number; created_at: string
  }[]
  const info = await infoRes.json()

  return (
    <div className="min-h-screen bg-gray-50">
      <ComercioHeader nombreLocal={info.nombre_local} />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Mis pedidos</h1>

        {pedidos.length === 0 ? (
          <p className="text-gray-500 text-sm">Todavía no hiciste ningún pedido.</p>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {pedidos.map(p => (
              <Link
                key={p.id}
                href={`/comercios/pedido/${p.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">Pedido #{p.id}</p>
                  <p className="text-xs text-gray-400">
                    {new Date(p.created_at).toLocaleDateString('es-AR', {
                      day: '2-digit', month: '2-digit', year: 'numeric'
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    ${p.total.toLocaleString('es-AR')}
                  </p>
                  <p className="text-xs text-gray-500">{ESTADOS[p.estado] ?? p.estado}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
