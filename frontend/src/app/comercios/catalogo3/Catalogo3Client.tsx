'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ShoppingCart, Check, Star, Zap, Award, Package } from 'lucide-react'
import { useComercioCart, CartItem } from '@/hooks/useComercioCart'
import { useComercioTheme } from '@/hooks/useComercioTheme'
import { getComercioTheme, type ComercioTheme } from '@/lib/comercio-theme'
import { resolveImageUrl } from '@/lib/api'
import { calcularPrecioPorDescuento, type TramoDescuento } from '@/lib/precios-comercio'

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

export function Catalogo3Client({ productos, montoMinimo, modoPrecio, redondeo, tramosDescuento }: Props) {
  const themeMode = useComercioTheme(s => s.mode)
  const theme = getComercioTheme(themeMode)
  const isDark = themeMode === 'dark'

  const add = useComercioCart(s => s.add)
  const setPricingConfig = useComercioCart(s => s.setPricingConfig)

  useEffect(() => {
    setPricingConfig({ modo_precio: modoPrecio, redondeo, tramos_descuento: tramosDescuento })
  }, [modoPrecio, redondeo, tramosDescuento, setPricingConfig])

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

        <h1 className="text-lg lg:text-xl font-bold mb-4 lg:mb-6" style={{ color: theme.textPrimary }}>Catálogo</h1>

        {productos.length === 0 ? (
          <p style={{ color: theme.textMuted }} className="text-sm">Todavía no hay productos cargados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 lg:gap-8 pb-4">
            {productos.map(p => (
              <ProductCard key={p.id} producto={p} onAdd={add} modoPrecio={modoPrecio} redondeo={redondeo} tramosDescuento={tramosDescuento} theme={theme} isDark={isDark} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProductCard({
  producto: p,
  onAdd,
  modoPrecio,
  redondeo,
  tramosDescuento,
  theme,
  isDark,
}: {
  producto: Producto
  onAdd: (item: Omit<CartItem, 'cantidad'>, cantidad: number) => void
  modoPrecio: 'markup' | 'descuento'
  redondeo: number
  tramosDescuento: TramoDescuento[]
  theme: ComercioTheme
  isDark: boolean
}) {
  const [cantidad, setCantidad] = useState(p.cantidad_minima || 1)
  const [added, setAdded] = useState(false)

  const imgUrl = resolveImageUrl(p.imagen_url)
  const faltan = p.cantidad_minima ? Math.max(0, p.cantidad_minima - cantidad) : 0
  const enModoDescuento = modoPrecio === 'descuento' && p.precio_venta != null

  const precioUnitario = enModoDescuento
    ? calcularPrecioPorDescuento(p.precio_venta as number, cantidad, tramosDescuento, redondeo)
    : p.precio_comercio
  const descuentoAplicado = enModoDescuento && precioUnitario < (p.precio_venta as number)
  const maxDescuento = enModoDescuento && tramosDescuento.length > 0
    ? Math.max(...tramosDescuento.map(t => t.descuento_porcentaje))
    : 0

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
      className="card-3d overflow-hidden flex flex-col"
      style={{
        backgroundColor: theme.cardBg,
        border: `1px solid ${theme.cardBorder}`,
        ...({
          '--shadow-color': isDark ? 'rgba(0,0,0,0.45)' : 'rgba(13,27,42,0.16)',
          '--shadow-color-soft': isDark ? 'rgba(0,0,0,0.25)' : 'rgba(13,27,42,0.08)',
        } as React.CSSProperties),
      }}
    >
      <Link href={`/comercios/producto/${p.id}`} className="contents">
        <div className="relative m-3 rounded-2xl aspect-[4/5] overflow-hidden" style={{ backgroundColor: theme.imagePlate }}>
          {imgUrl ? (
            <Image src={imgUrl} alt={p.nombre} fill className="object-contain" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: '#B7AF9C' }}>Sin imagen</div>
          )}

          {(p.is_featured || p.is_immediate_delivery || p.is_best_seller) && (
            <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
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

          {maxDescuento > 0 && (
            <span
              className="absolute top-2.5 right-2.5 rounded-full px-2 py-0.5 text-[10px] font-bold shadow-md"
              style={{ backgroundColor: theme.savings, color: '#fff' }}
            >
              Hasta −{maxDescuento}%
            </span>
          )}
        </div>

        <div className="px-4 pt-1 flex flex-col gap-1">
          {p.marca && (
            <p className="text-[10px] font-semibold uppercase tracking-widest truncate" style={{ color: theme.textFaint }}>{p.marca}</p>
          )}
          <p className="text-base font-semibold leading-snug line-clamp-2" style={{ color: theme.textPrimary }}>{p.nombre}</p>

          <p className="text-xl font-extrabold mt-1" style={{ color: descuentoAplicado ? theme.savings : theme.accent }}>
            {!descuentoAplicado && (
              <span className="text-[10px] font-normal mr-1" style={{ color: theme.textFaint }}>Minorista:</span>
            )}
            ${precioUnitario.toLocaleString('es-AR')}
          </p>

          <div className="flex flex-wrap gap-1 mt-0.5">
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
        </div>
      </Link>

      {!p.is_on_demand && (
        <div className="flex items-center justify-center px-4 py-1.5 min-h-[24px]">
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

      <div className="px-4 pb-4 pt-2 flex flex-col gap-1.5 mt-auto">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => setCantidad(c => Math.max(1, c - 1))}
            className="w-8 h-8 rounded-lg text-sm font-medium"
            style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
          >−</button>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-14 text-center rounded-lg text-sm py-1 focus:outline-none"
            style={{ backgroundColor: 'transparent', border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
          />
          <button
            onClick={() => setCantidad(c => c + 1)}
            className="w-8 h-8 rounded-lg text-sm font-medium"
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
