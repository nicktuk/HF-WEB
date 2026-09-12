'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Check, Star, Zap, Award, ChevronLeft, ChevronRight, Search, Package } from 'lucide-react'
import { useComercioCart, CartItem } from '@/hooks/useComercioCart'
import { useComercioTheme } from '@/hooks/useComercioTheme'
import { getComercioTheme, getTramoScaleColor, type ComercioTheme } from '@/lib/comercio-theme'
import { resolveImageUrl } from '@/lib/api'
import { calcularPrecioPorDescuento, type TramoDescuento } from '@/lib/precios-comercio'
import { SavingsBar } from '../_components/SavingsBar'

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
  const themeMode = useComercioTheme(s => s.mode)
  const theme = getComercioTheme(themeMode)

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

  const cardProps = { modoPrecio, redondeo, tramosDescuento, onAdd: add, theme }
  const tituloCarousel = categoria || (search.trim() !== '' ? 'Resultados' : 'Catálogo')

  return (
    <div className="relative overflow-x-hidden" style={{ backgroundColor: theme.pageBg, minHeight: '100vh' }}>
      {/* Glow decorativo — solo en tema oscuro */}
      <div
        className="pointer-events-none absolute -top-24 -right-32 w-[520px] h-[520px] rounded-full opacity-25"
        style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 68%)`, filter: 'blur(10px)', opacity: 0.25 * theme.glowOpacity }}
      />
      <div
        className="pointer-events-none absolute top-[420px] -left-40 w-[420px] h-[420px] rounded-full"
        style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 70%)`, filter: 'blur(10px)', opacity: 0.12 * theme.glowOpacity }}
      />

      <div className="relative w-full px-5 sm:px-8 lg:px-12 pt-4 pb-8 lg:pt-5 lg:pb-12">

        {montoMinimo > 0 && (
          <div
            className="mb-4 rounded-2xl px-5 py-3 text-sm"
            style={{ backgroundColor: theme.accentTint(0.1), border: `1.5px solid ${theme.accentTint(0.3)}`, color: theme.accent }}
          >
            Pedido mínimo: <strong>${montoMinimo.toLocaleString('es-AR')}</strong>
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4 lg:mb-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: theme.textFaint }} />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 pr-4 py-3 text-sm rounded-full w-64 focus:outline-none"
              style={{ backgroundColor: theme.inputBg, border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
            />
          </div>
          {categorias.length > 0 && (
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              className="px-4 py-3 text-sm rounded-full focus:outline-none"
              style={{ backgroundColor: theme.inputBg, border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
            >
              <option value="" style={{ color: '#111' }}>Todas las categorías</option>
              {categorias.map(c => <option key={c} value={c} style={{ color: '#111' }}>{c}</option>)}
            </select>
          )}
        </div>

        {filtered.length === 0 && (
          <p style={{ color: theme.textMuted }} className="text-sm">No hay productos que coincidan.</p>
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
  theme,
}: {
  title: string
  productos: Producto[]
  onAdd: (item: Omit<CartItem, 'cantidad'>, cantidad: number) => void
  modoPrecio: 'markup' | 'descuento'
  redondeo: number
  tramosDescuento: TramoDescuento[]
  theme: ComercioTheme
}) {
  const scrollerRef = useRef<HTMLDivElement>(null)

  function scrollBy(amount: number) {
    scrollerRef.current?.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <section>
      <h2 className="text-lg lg:text-xl font-bold mb-4" style={{ color: theme.textPrimary }}>{title}</h2>

      <div className="relative">
        <div ref={scrollerRef} className="flex gap-4 lg:gap-5 overflow-x-auto scrollbar-hide pb-2 -mx-1 px-1">
          {productos.map(p => (
            <ProductCard key={p.id} producto={p} onAdd={onAdd} modoPrecio={modoPrecio} redondeo={redondeo} tramosDescuento={tramosDescuento} theme={theme} />
          ))}
        </div>

        <button
          onClick={() => scrollBy(-560)}
          className="hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full items-center justify-center shadow-lg opacity-90 hover:opacity-100 transition-opacity backdrop-blur-sm"
          style={{ backgroundColor: theme.cardBg, border: `1.5px solid ${theme.cardBorder}`, color: theme.textPrimary }}
          aria-label="Anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => scrollBy(560)}
          className="hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full items-center justify-center shadow-lg opacity-90 hover:opacity-100 transition-opacity backdrop-blur-sm"
          style={{ backgroundColor: theme.cardBg, border: `1.5px solid ${theme.cardBorder}`, color: theme.textPrimary }}
          aria-label="Siguiente"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
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
  theme,
}: {
  producto: Producto
  onAdd: (item: Omit<CartItem, 'cantidad'>, cantidad: number) => void
  modoPrecio: 'markup' | 'descuento'
  redondeo: number
  tramosDescuento: TramoDescuento[]
  theme: ComercioTheme
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
  const descuentoAplicado = enModoDescuento && precioUnitario < (p.precio_venta as number)

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
      style={{ backgroundColor: theme.cardBg, border: `1.5px solid ${theme.cardBorder}` }}
    >
      <Link href={`/comercios/producto/${p.id}`} className="contents">
        <div className="relative m-2.5 rounded-xl aspect-square" style={{ backgroundColor: theme.imagePlate }}>
          {imgUrl ? (
            <Image src={imgUrl} alt={p.nombre} fill className="object-cover" unoptimized />
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
            <p className="text-[10px] font-semibold uppercase tracking-widest truncate" style={{ color: theme.textFaint }}>{p.marca}</p>
          )}
          <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: theme.textPrimary }}>{p.nombre}</p>

          <div className="flex flex-wrap gap-1">
            {p.unidades_por_bulto && (
              <span className="text-[10px] rounded px-1.5 py-0.5" style={{ backgroundColor: theme.accentTint(0.08), color: theme.textMuted }}>
                Bulto x{p.unidades_por_bulto}
              </span>
            )}
            {p.cantidad_minima && (
              <span className="text-[10px] rounded px-1.5 py-0.5" style={{ backgroundColor: theme.accentTint(0.12), color: theme.accent }}>
                Mín. {p.cantidad_minima} u.
              </span>
            )}
          </div>

          <p className="text-lg font-extrabold mt-0.5 text-center" style={{ color: descuentoAplicado ? theme.savings : theme.accent }}>
            {!descuentoAplicado && (
              <span className="text-[10px] font-normal mr-1" style={{ color: theme.textFaint }}>Minorista:</span>
            )}
            ${precioUnitario.toLocaleString('es-AR')}
          </p>

          {enModoDescuento && tramosDescuento.length > 0 && (
            <div className="rounded-xl overflow-hidden mt-1" style={{ backgroundColor: theme.accentTint(0.05), border: `1.5px solid ${theme.accentTint(0.25)}` }}>
              <div className="px-3 pt-2.5 pb-2">
                <SavingsBar
                  precioVenta={p.precio_venta as number}
                  cantidad={cantidad}
                  tramos={tramosDescuento}
                  redondeo={redondeo}
                  theme={theme}
                  compact
                />
              </div>
              <div style={{ height: 1, backgroundColor: theme.accentTint(0.2) }} />
              <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
                <tbody>
                  {(() => {
                    const maxDescuento = Math.max(...tramosDescuento.map(t => t.descuento_porcentaje))
                    return tramosDescuento.map(t => {
                      const activo = cantidad >= t.cantidad_minima
                        && !tramosDescuento.some(o => o.cantidad_minima > t.cantidad_minima && o.cantidad_minima <= cantidad)
                      const colorTramo = getTramoScaleColor(maxDescuento > 0 ? t.descuento_porcentaje / maxDescuento : 0)
                      return (
                        <tr key={t.cantidad_minima} style={activo ? { backgroundColor: theme.accent } : undefined}>
                          <td className="py-2 pl-3 font-semibold" style={{ color: activo ? theme.buttonBg : theme.textMuted }}>{t.cantidad_minima}+ u.</td>
                          <td className="py-2 font-bold" style={{ color: activo ? theme.buttonBg : colorTramo }}>−{t.descuento_porcentaje}%</td>
                          <td className="py-2 pr-3 text-right font-bold" style={{ color: activo ? theme.buttonBg : theme.textPrimary }}>
                            ${calcularPrecioPorDescuento(p.precio_venta as number, t.cantidad_minima, tramosDescuento, redondeo).toLocaleString('es-AR')}
                          </td>
                        </tr>
                      )
                    })
                  })()}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </Link>

      {!p.is_on_demand && (
        <div className="flex-1 flex items-center justify-center px-3.5 py-1 min-h-[24px]">
          {p.stock <= 5 ? (
            <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: theme.urgency }}>
              <Package className="h-3.5 w-3.5" />
              ¡Últimas {p.stock} unidades!
            </p>
          ) : (
            <p className="text-xs flex items-center gap-1.5" style={{ color: theme.textMuted }}>
              <Package className="h-3.5 w-3.5" />
              Stock: <strong style={{ color: theme.textPrimary }}>{p.stock}</strong> u.
            </p>
          )}
        </div>
      )}

      <div className="px-3.5 pb-3.5 pt-2 flex flex-col gap-1.5 mt-auto">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => setCantidad(c => Math.max(1, c - 1))}
            className="w-7 h-7 rounded-lg text-sm font-medium"
            style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
          >−</button>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-12 text-center rounded-lg text-sm py-0.5 focus:outline-none"
            style={{ backgroundColor: 'transparent', border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
          />
          <button
            onClick={() => setCantidad(c => c + 1)}
            className="w-7 h-7 rounded-lg text-sm font-medium"
            style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
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
              ? { backgroundColor: theme.buttonAddedBg, color: theme.accent, border: `1.5px solid ${theme.accent}` }
              : { backgroundColor: theme.buttonBg, color: theme.buttonText, border: `1.5px solid ${theme.buttonBorder}` }}
          >
            {added ? <Check className="h-3.5 w-3.5" /> : <ShoppingCart className="h-3.5 w-3.5" />}
            {added ? 'Agregado' : 'Agregar al pedido'}
          </button>
        )}
      </div>
    </div>
  )
}
