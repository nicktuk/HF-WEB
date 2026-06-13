'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useMayoristaCart } from '@/hooks/useMayoristaCart'
import { resolveImageUrl } from '@/lib/api'

interface Producto {
  id: number
  nombre: string
  precio_mayorista: number
  stock: number
  is_on_demand: boolean
  imagen_url: string | null
  categoria: string | null
  subcategoria: string | null
}

interface Props {
  productos: Producto[]
  montoMinimo: number
}

export function CatalogoClient({ productos, montoMinimo }: Props) {
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const add = useMayoristaCart(s => s.add)

  const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))] as string[]

  const filtered = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoria || p.categoria === categoria
    return matchSearch && matchCat
  })

  return (
    <div>
      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-gray-300"
        />
        {categorias.length > 0 && (
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-gray-500 text-sm">No hay productos que coincidan.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {filtered.map(p => (
          <ProductCard key={p.id} producto={p} onAdd={add} />
        ))}
      </div>
    </div>
  )
}

function ProductCard({
  producto: p,
  onAdd,
}: {
  producto: Producto
  onAdd: ReturnType<typeof useMayoristaCart>['add']
}) {
  const [cantidad, setCantidad] = useState(1)
  const [added, setAdded] = useState(false)

  const imgUrl = resolveImageUrl(p.imagen_url)

  function handleAdd() {
    onAdd(
      { producto_id: p.id, nombre: p.nombre, imagen_url: p.imagen_url, precio_mayorista: p.precio_mayorista },
      cantidad,
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="aspect-square bg-gray-100 relative">
        {imgUrl ? (
          <Image src={imgUrl} alt={p.nombre} fill className="object-contain p-2" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">Sin imagen</div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2 flex-1">
        <p className="text-xs text-gray-700 font-medium leading-snug line-clamp-2">{p.nombre}</p>

        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5">Mayorista</span>
        </div>

        <p className="text-base font-bold text-gray-900">
          ${p.precio_mayorista.toLocaleString('es-AR')}
        </p>

        {!p.is_on_demand && (
          <p className="text-xs text-gray-400">Stock: {p.stock} u.</p>
        )}

        <div className="flex items-center gap-1 mt-auto">
          <button
            onClick={() => setCantidad(c => Math.max(1, c - 1))}
            className="w-7 h-7 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 text-center border border-gray-300 rounded text-sm py-0.5 focus:outline-none"
          />
          <button
            onClick={() => setCantidad(c => c + 1)}
            className="w-7 h-7 border border-gray-300 rounded text-sm font-medium hover:bg-gray-50"
          >
            +
          </button>
        </div>

        <button
          onClick={handleAdd}
          className={`w-full rounded-lg py-1.5 text-xs font-medium transition-colors ${
            added
              ? 'bg-green-600 text-white'
              : 'bg-gray-900 text-white hover:bg-gray-700'
          }`}
        >
          {added ? '¡Agregado!' : 'Agregar al pedido'}
        </button>
      </div>
    </div>
  )
}
