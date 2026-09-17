'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { VendedorHeader } from '../_components/VendedorHeader'
import { resolveImageUrl } from '@/lib/api'

interface Escalon {
  cantidad_minima: number
  precio_unitario: number
  ganancia_unitaria: number | null
}

interface ProductoDemo {
  id: number
  nombre: string
  marca: string | null
  precio_comercio: number
  precio_venta: number | null
  ganancia_unitaria: number | null
  stock: number
  imagen_url: string | null
  cantidad_minima: number | null
  escalones: Escalon[]
}

export default function CatalogoDemoPage() {
  const [productos, setProductos] = useState<ProductoDemo[] | null>(null)

  useEffect(() => {
    fetch('/api/vendedores/catalogo-demo')
      .then(res => (res.ok ? res.json() : { productos: [] }))
      .then(data => setProductos(data.productos))
  }, [])

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Catálogo demo</h1>
          <p className="text-sm text-zinc-500">
            La cuenta lista para hacer en voz alta frente al comerciante: precio mayorista, precio de público y cuánto le queda por unidad.
          </p>
        </div>

        {!productos ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <div className="space-y-3">
            {productos.map(p => {
              const imagenUrl = resolveImageUrl(p.imagen_url)
              return (
              <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
                <div className="flex items-center gap-3 mb-3">
                  {imagenUrl && (
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-zinc-50 relative">
                      <Image src={imagenUrl} alt={p.nombre} fill className="object-contain" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-800 truncate">{p.nombre}</p>
                    {p.marca && <p className="text-xs text-zinc-500">{p.marca}</p>}
                    <p className="text-xs text-zinc-400">Stock: {p.stock}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div className="bg-zinc-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-zinc-500">Precio mayorista</p>
                    <p className="font-semibold text-zinc-800">${p.precio_comercio.toLocaleString('es-AR')}</p>
                  </div>
                  <div className="bg-zinc-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-zinc-500">Precio público</p>
                    <p className="font-semibold text-zinc-800">
                      {p.precio_venta != null ? `$${p.precio_venta.toLocaleString('es-AR')}` : '—'}
                    </p>
                  </div>
                </div>

                {p.escalones.length > 1 && (
                  <div className="border-t border-zinc-100 pt-3">
                    <p className="text-xs font-medium text-zinc-500 mb-2">Ganancia por unidad según cantidad</p>
                    <div className="flex gap-2 flex-wrap">
                      {p.escalones.map(e => (
                        <div key={e.cantidad_minima} className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-1.5 text-center">
                          <p className="text-xs text-emerald-700">{e.cantidad_minima}+ un.</p>
                          <p className="text-sm font-semibold text-emerald-800">
                            {e.ganancia_unitaria != null ? `+$${e.ganancia_unitaria.toLocaleString('es-AR')}` : '—'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
