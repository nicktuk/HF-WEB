'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Check, Star, Zap, Award, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useComercioCart, CartItem } from '@/hooks/useComercioCart'
import { resolveImageUrl } from '@/lib/api'
import { calcularPrecioPorDescuento, type TramoDescuento } from '@/lib/precios-comercio'

const LIME = '#B4F42A'

interface Producto {
  id: number
  nombre: string
  marca: string | null
  precio_comercio: number
  precio_venta: number | null
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
  modoPrecio: 'markup' | 'descuento'
  redondeo: number
  tramosDescuento: TramoDescuento[]
}

export function CatalogoClient({ productos, montoMinimo, modoPrecio, redondeo, tramosDescuento }: Props) {
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('')
  const add = useComercioCart(s => s.add)
  const setPricingConfig = useComercioCart(s => s.setPricingConfig)

  useEffect(() => {
    setPricingConfig({ modo_precio: modoPrecio, redondeo, tramos_descuento: tramosDescuento })
  }, [modoPrecio, redondeo, tramosDescuento, setPricingConfig])

  const categorias = Array.from(new Set(productos.map(p => p.categoria).filter(Boolean))) as string[]

  const filtered = productos.filter(p => {
    const matchSearch = p.nombre.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoria || p.categoria === categoria
    return matchSearch && matchCat
  })

  const cardProps = { modoPrecio, redondeo, tramosDescuento, onAdd: add }
  const tituloCarousel = categoria || (search.trim() !== '' ? 'Resultados' : 'Catálogo')

  return (
    <div className="relative" style={{ backgroundColor: '#0D1B2A', minHeight: '100vh' }}>
      {/* Glow decorativo */}
      <div
        className="pointer-events-none absolute -top-24 -right-32 w-[520px] h-[520px] rounded-full opacity-25"
        style={{ background: `radial-gradient(circle, ${LIME} 0%, transparent 68%)`, filter: 'blur(10px)' }}
      />
      <div
        className="pointer-events-none absolute top-[420px] -left-40 w-[420px] h-[420px] rounded-full opacity-[0.12]"
        style={{ background: `radial-gradient(circle, ${LIME} 0%, transparent 70%)`, filter: 'blur(10px)' }}
      />

      <div className="relative max-w-[1400px] mx-auto px-5 sm:px-8 lg:px-12 py-8 lg:py-12">

        {montoMinimo > 0 && (
          <div
            className="mb-6 rounded-2xl px-5 py-3 text-sm"
            style={{ backgroundColor: 'rgba(180,244,42,0.1)', border: '1px solid rgba(180,244,42,0.25)', color: LIME }}
          >
            Pedido mínimo: <strong>${montoMinimo.toLocaleString('es-AR')}</strong>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-10 lg:mb-14">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'rgba(244,246,242,0.4)' }} />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-3 text-sm rounded-full w-64 focus:outline-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#EFF3F8' }}
            />
          </div>
          {categorias.length > 0 && (
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="px-4 py-3 text-sm rounded-full focus:outline-none"
              style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#EFF3F8' }}
            >
              <option value="" style={{ color: '#111' }}>Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c} style={{ color: '#111' }}>{c}</option>)}
            </select>
          )}
        </div>

        {filtered.length === 0 && (
          <p style={{ color: 'rgba(244,246,242,0.5)' }} className="text-sm">No hay productos que coincidan.</p>
        )}

        {filtered.length > 0 && (
          <CarouselRow title={tituloCarousel} productos={filtered} {...cardProps} />
        )}
      </div>
    </div>
  )
}

function CarouselRow({
  title,
  productos,
  onAdd,
  modoPrecio,
  redondeo,
  tramosDescuento,
}: {
  title: string
  productos: Producto[]
  onAdd: (item: Omit<CartItem, 'cantidad'>, cantidad: number) => void
  modoPrecio: 'markup' | 'descuento'
  redondeo: number
  tramosDescuento: TramoDescuento[]
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  function scrollBy(amount: number) {
    scrollerRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg lg:text-xl font-bold" style={{ color: '#EFF3F8' }}>{title}</h2>
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => scrollBy(-560)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#EFF3F8' }}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy(560)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#EFF3F8' }}
            aria-label="Siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={scrollerRef} className="flex gap-4 lg:gap-5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
        {productos.map(p => (
          <ProductCard key={p.id} producto={p} onAdd={onAdd} modoPrecio={modoPrecio} redondeo={redondeo} tramosDescuento={tramosDescuento} />
        ))}
      </div>
    </section>
  )
}

function ProductCard({
  producto: p,
  onAdd,
  modoPrecio,
  redondeo,
  tramosDescuento,
}: {
  producto: Producto
  onAdd: (item: Omit<CartItem, 'cantidad'>, cantidad: number) => void
  modoPrecio: 'markup' | 'descuento'
  redondeo: number
  tramosDescuento: TramoDescuento[]
}) {
  const CARD_WIDTH = tramosDescuento.length > 0 && modoPrecio === 'descuento' ? 'w-[220px] lg:w-[260px]' : 'w-[190px] lg:w-[220px]'
  const [cantidad, setCantidad] = useState(p.cantidad_minima || 1)
  const [added, setAdded] = useState(false)

  const imgUrl = resolveImageUrl(p.imagen_url)
  const faltan = p.cantidad_minima ? Math.max(0, p.cantidad_minima - cantidad) : 0
  const enModoDescuento = modoPrecio === 'descuento' && p.precio_venta != null

  const precioUnitario = enModoDescuento
    ? calcularPrecioPorDescuento(p.precio_venta as number, cantidad, tramosDescuento, redondeo)
    : p.precio_comercio

  function handleAdd() {
    onAdd(
      {
        producto_id: p.id,
        nombre: p.nombre,
        imagen_url: p.imagen_url,
        precio_comercio: p.precio_comercio,
        precio_venta: p.precio_venta,
        cantidad_minima: p.cantidad_minima,
      },
      cantidad,
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  return (
    <div
      className={`shrink-0 ${CARD_WIDTH} rounded-2xl overflow-hidden flex flex-col`}
      style={{ backgroundColor: '#132845', border: '1px solid rgba(180,244,42,0.14)' }}
    >
      <Link href={`/comercios/producto/${p.id}`} className="contents">
        <div className="relative m-2.5 rounded-xl aspect-square" style={{ backgroundColor: '#F4F1E7' }}>
          {imgUrl ? (
            <Image src={imgUrl} alt={p.nombre} fill className="object-contain p-3" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: '#B7AF9C' }}>Sin imagen</div>
          )}

          {(p.is_featured || p.is_immediate_delivery || p.is_best_seller) && (
            <div className="absolute top-2 left-2 flex flex-col gap-1">
              {p.is_featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                  <Star className="w-2.5 h-2.5 fill-current" />Nuevo
                </span>
              )}
              {p.is_immediate_delivery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                  <Zap className="w-2.5 h-2.5 fill-current" />Inmediata
                </span>
              )}
              {p.is_best_seller && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                  <Award className="w-2.5 h-2.5" />Top
                </span>
              )}
            </div>
          )}
        </div>

        <div className="px-3.5 pt-1 flex flex-col gap-1.5">
          {p.marca && (
            <p className="text-[10px] font-semibold uppercase tracking-widest truncate" style={{ color: 'rgba(244,246,242,0.4)' }}>{p.marca}</p>
          )}
          <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: '#EFF3F8' }}>{p.nombre}</p>

          <div className="flex flex-wrap gap-1">
            {p.unidades_por_bulto && (
              <span className="text-[10px] rounded px-1.5 py-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(244,246,242,0.6)' }}>
                Bulto x{p.unidades_por_bulto}
              </span>
            )}
            {p.cantidad_minima && (
              <span className="text-[10px] rounded px-1.5 py-0.5" style={{ backgroundColor: 'rgba(180,244,42,0.12)', color: LIME }}>
                Mín. {p.cantidad_minima} u.
              </span>
            )}
          </div>

          {enModoDescuento ? (
            <div className="mt-0.5">
              <p className="text-lg font-extrabold" style={{ color: LIME }}>${precioUnitario.toLocaleString('es-AR')}</p>
              <p className="text-[10px]" style={{ color: 'rgba(244,246,242,0.4)' }}>Lista ${(p.precio_venta as number).toLocaleString('es-AR')}</p>
            </div>
          ) : (
            <p className="text-lg font-extrabold mt-0.5" style={{ color: LIME }}>${precioUnitario.toLocaleString('es-AR')}</p>
          )}

          {enModoDescuento && tramosDescuento.length > 0 && (
            <table className="w-full text-[10px] mt-0.5" style={{ borderCollapse: 'collapse' }}>
              <tbody>
                {tramosDescuento.map(t => {
                  const activo = cantidad >= t.cantidad_minima
                    && !tramosDescuento.some(o => o.cantidad_minima > t.cantidad_minima && o.cantidad_minima <= cantidad)
                  return (
                    <tr key={t.cantidad_minima} style={activo ? { backgroundColor: 'rgba(180,244,42,0.12)' } : undefined}>
                      <td className="py-0.5 pl-1" style={{ color: activo ? LIME : 'rgba(244,246,242,0.55)' }}>{t.cantidad_minima}+ u.</td>
                      <td className="py-0.5" style={{ color: activo ? LIME : 'rgba(244,246,242,0.55)' }}>{t.descuento_porcentaje}%</td>
                      <td className="py-0.5 pr-1 text-right font-semibold" style={{ color: activo ? LIME : '#EFF3F8' }}>
                        ${calcularPrecioPorDescuento(p.precio_venta as number, t.cantidad_minima, tramosDescuento, redondeo).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {!p.is_on_demand && (
            <p className="text-xs" style={{ color: 'rgba(244,246,242,0.45)' }}>Stock: <strong style={{ color: '#EFF3F8' }}>{p.stock}</strong> u.</p>
          )}
        </div>
      </Link>

      <div className="px-3.5 pb-3.5 pt-2 flex flex-col gap-1.5 mt-auto">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCantidad(c => Math.max(1, c - 1))}
            className="w-7 h-7 rounded-lg text-sm font-medium"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#EFF3F8' }}
          >−</button>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 text-center rounded-lg text-sm py-0.5 focus:outline-none"
            style={{ backgroundColor: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#EFF3F8' }}
          />
          <button
            onClick={() => setCantidad(c => c + 1)}
            className="w-7 h-7 rounded-lg text-sm font-medium"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#EFF3F8' }}
          >+</button>
        </div>

        {faltan > 0 ? (
          <p className="text-[11px] font-medium text-center" style={{ color: '#E8C15A' }}>
            Te faltan {faltan} u. para el mínimo de {p.cantidad_minima}
          </p>
        ) : (
          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold py-2.5 transition-colors"
            style={added
              ? { backgroundColor: 'rgba(180,244,42,0.15)', color: LIME, border: `1px solid ${LIME}` }
              : { backgroundColor: LIME, color: '#0D1B2A' }}
          >
            {added ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
            {added ? 'Agregado' : 'Agregar al pedido'}
          </button>
        )}
      </div>
    </div>
  )
}
