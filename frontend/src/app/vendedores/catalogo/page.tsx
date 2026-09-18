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

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-800">
          Los precios los define HEFA con la matriz de descuento por cantidad — no se pueden editar
          desde acá a propósito: si un cliente pide algo fuera de la matriz, se escala a administración
          en vez de negociarlo en el momento.
        </div>

        {!productos ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <div className="bg-white rounded-2xl vendedor-card p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="pl-1" />
                    <th className="text-left py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Producto</th>
                    <th className="text-right py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Stock</th>
                    <th className="text-right py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">P. mayorista</th>
                    <th className="text-right py-2 pr-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">P. público</th>
                    <th className="text-left py-2 pl-2 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Ganancia por cantidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {productos.map(p => {
                    const imagenUrl = resolveImageUrl(p.imagen_url)
                    return (
                      <tr key={p.id}>
                        <td className="py-2 pl-1">
                          {imagenUrl && (
                            <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-zinc-50 relative">
                              <Image src={imagenUrl} alt={p.nombre} fill className="object-contain" />
                            </div>
                          )}
                        </td>
                        <td className="py-2 pr-2">
                          <p className="font-medium text-zinc-800 truncate max-w-[160px]">{p.nombre}</p>
                          {p.marca && <p className="text-xs text-zinc-500">{p.marca}</p>}
                        </td>
                        <td className="py-2 pr-2 text-right text-zinc-500">{p.stock}</td>
                        <td className="py-2 pr-2 text-right font-semibold text-zinc-800 whitespace-nowrap">
                          ${p.precio_comercio.toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 pr-2 text-right font-semibold text-zinc-800 whitespace-nowrap">
                          {p.precio_venta != null ? `$${p.precio_venta.toLocaleString('es-AR')}` : '—'}
                        </td>
                        <td className="py-2 pl-2">
                          {p.escalones.length > 1 && (
                            <div className="flex gap-1.5 flex-wrap">
                              {p.escalones.map(e => (
                                <div key={e.cantidad_minima} className="bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 text-center whitespace-nowrap">
                                  <span className="text-[10px] text-emerald-700">{e.cantidad_minima}+ un. </span>
                                  <span className="text-xs font-semibold text-emerald-800">
                                    {e.ganancia_unitaria != null ? `+$${e.ganancia_unitaria.toLocaleString('es-AR')}` : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
