'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ShoppingCart, Check, Star, Zap, Award } from 'lucide-react'
import { useComercioCart, CartItem } from '@/hooks/useComercioCart'
import { resolveImageUrl } from '@/lib/api'

interface Producto {
  id: number
  nombre: string
  marca: string | null
  precio_comercio: number
  stock: number
  is_on_demand: boolean
  imagen_url: string | null
  categoria: string | null
  subcategoria: string | null
  unidades_por_bulto: number | null
  cantidad_minima: number | null
  is_featured: boolean
  is_immediate_delivery: boolean
  is_best_seller: boolean
}

interface Props {
  productos: Producto[]
  montoMinimo: number
}

export function CatalogoClient({ productos, montoMinimo }: Props) {
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const add = useComercioCart(s => s.add)

  const categorias = Array.from(new Set(productos.map(p => p.categoria).filter(Boolean))) as string[]

  const filtered = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoria || p.categoria === categoria
    return matchSearch && matchCat
  })

  return (
    <div>
      {montoMinimo > 0 && (
        <div className="mb-5 rounded-xl bg-primary-50 border border-primary-100 px-4 py-2.5 text-sm text-primary-800">
          Pedido mínimo: <strong>${montoMinimo.toLocaleString('es-AR')}</strong>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Buscar producto..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-zinc-300 rounded-lg px-3 py-2 text-sm w-60 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
        />
        {categorias.length > 0 && (
          <select
            value={categoria}
            onChange={e => setCategoria(e.target.value)}
            className="border border-zinc-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          >
            <option value="">Todas las categorías</option>
            {categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="text-zinc-500 text-sm">No hay productos que coincidan.</p>
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
  onAdd: (item: Omit<CartItem, 'cantidad'>, cantidad: number) => void
}) {
  const [cantidad, setCantidad] = useState(p.cantidad_minima || 1)
  const [added, setAdded] = useState(false)

  const imgUrl = resolveImageUrl(p.imagen_url)

  function handleAdd() {
    onAdd(
      {
        producto_id: p.id,
        nombre: p.nombre,
        imagen_url: p.imagen_url,
        precio_comercio: p.precio_comercio,
        cantidad_minima: p.cantidad_minima,
      },
      cantidad,
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm card-lift overflow-hidden flex flex-col">
      <div className="aspect-square bg-zinc-50 relative">
        {imgUrl ? (
          <Image src={imgUrl} alt={p.nombre} fill className="object-contain p-2" unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">Sin imagen</div>
        )}

        {(p.is_featured || p.is_immediate_delivery || p.is_best_seller) && (
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {p.is_featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                <Star className="w-2.5 h-2.5 fill-current" />
                Nuevo
              </span>
            )}
            {p.is_immediate_delivery && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                <Zap className="w-2.5 h-2.5 fill-current" />
                Inmediata
              </span>
            )}
            {p.is_best_seller && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                <Award className="w-2.5 h-2.5" />
                Top
              </span>
            )}
          </div>
        )}
      </div>

      <div className="p-3 flex flex-col gap-1.5 flex-1">
        <div className="flex items-center justify-between gap-2 min-h-[16px]">
          {p.categoria && (
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 truncate">{p.categoria}</p>
          )}
          {p.marca && (
            <p className="text-[10px] text-zinc-400 truncate text-right shrink-0">{p.marca}</p>
          )}
        </div>

        <p className="text-sm text-zinc-800 font-semibold leading-snug line-clamp-2">{p.nombre}</p>

        <div className="flex flex-wrap gap-1">
          {p.unidades_por_bulto && (
            <span className="text-[10px] text-zinc-500 bg-zinc-100 rounded px-1.5 py-0.5">
              Bulto x{p.unidades_por_bulto}
            </span>
          )}
          {p.cantidad_minima && (
            <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
              Mín. {p.cantidad_minima} u.
            </span>
          )}
        </div>

        <p className="text-lg font-extrabold text-zinc-900 mt-0.5">
          ${p.precio_comercio.toLocaleString('es-AR')}
        </p>

        {!p.is_on_demand && (
          <p className="text-xs text-zinc-500">Stock: <strong>{p.stock}</strong> u.</p>
        )}

        <div className="flex items-center gap-1.5 mt-auto pt-1">
          <button
            onClick={() => setCantidad(c => Math.max(p.cantidad_minima || 1, c - 1))}
            className="w-7 h-7 border border-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50"
          >
            −
          </button>
          <input
            type="number"
            min={p.cantidad_minima || 1}
            value={cantidad}
            onChange={e => setCantidad(Math.max(p.cantidad_minima || 1, parseInt(e.target.value) || 1))}
            className="w-12 text-center border border-zinc-300 rounded-lg text-sm py-0.5 focus:outline-none"
          />
          <button
            onClick={() => setCantidad(c => c + 1)}
            className="w-7 h-7 border border-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50"
          >
            +
          </button>
        </div>

        <button
          onClick={handleAdd}
          className={`w-full flex items-center justify-center gap-1.5 rounded-xl border text-xs font-semibold py-2 transition-colors ${
            added
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-700'
          }`}
        >
          {added ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
          {added ? 'Agregado' : 'Agregar al pedido'}
        </button>
      </div>
    </div>
  )
}
