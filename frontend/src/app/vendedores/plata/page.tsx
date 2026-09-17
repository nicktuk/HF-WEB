'use client'

import { useEffect, useState } from 'react'
import { VendedorHeader } from '../_components/VendedorHeader'

interface ComisionItem {
  id: number
  pedido_id: number
  comercio_nombre: string | null
  base: number
  tasa: number
  monto: number
  estado: string
}

interface MiPlata {
  items: ComisionItem[]
  total_pendiente: number
  total_liquidado: number
}

export default function MiPlataPage() {
  const [plata, setPlata] = useState<MiPlata | null>(null)

  useEffect(() => {
    fetch('/api/vendedores/mi-plata')
      .then(res => (res.ok ? res.json() : null))
      .then(setPlata)
  }, [])

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mi plata</h1>
          <p className="text-sm text-zinc-500">Comisión por cada pedido pagado de tu cartera.</p>
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

            {plata.items.length === 0 ? (
              <p className="text-sm text-zinc-400">Todavía no tenés comisiones registradas.</p>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 divide-y divide-zinc-100">
                {plata.items.map(c => (
                  <div key={c.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-zinc-800 truncate">
                        {c.comercio_nombre ?? `Pedido #${c.pedido_id}`}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {(c.tasa * 100).toFixed(0)}% sobre ${c.base.toLocaleString('es-AR')}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-zinc-800">${c.monto.toLocaleString('es-AR')}</p>
                      <span className={`text-xs font-medium ${c.estado === 'pagado' || c.estado === 'liquidada' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {c.estado === 'liquidada' ? 'Liquidada' : 'Pendiente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
