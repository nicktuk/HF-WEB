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

export function Catalogo4Client({ productos, montoMinimo, modoPrecio, redondeo, tramosDescuento }: Props) {
  const themeMode = useComercioTheme(s => s.mode)
  const theme = getComercioTheme(themeMode)

  const add = useComercioCart(s => s.add)
  const setPricingConfig = useComercioCart(s => s.setPricingConfig)

  useEffect(() => {
    setPricingConfig({ modo_precio: modoPrecio, redondeo, tramos_descuento: tramosDescuento })
  }, [modoPrecio, redondeo, tramosDescuento, setPricingConfig])

  return (
    <div className="relative overflow-x-hidden" style={{ backgroundColor: theme.pageBg, minHeight: '100vh' }}>
      <div
        className="pointer-events-none absolute -top-24 -right-32 w-[520px] h-[520px] rounded-full opacity-25"
        style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 68%)`, filter: 'blur(10px)', opacity: 0.25 * theme.glowOpacity }}
      />

      <div className="relative w-full max-w-3xl mx-auto px-5 sm:px-8 pt-4 pb-8 lg:pt-6 lg:pb-12">

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
            {productos.map(p => (
              <ProductCard key={p.id} producto={p} onAdd={add} modoPrecio={modoPrecio} redondeo={redondeo} tramosDescuento={tramosDescuento} theme={theme} />
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
}: {
  producto: Producto
  onAdd: (item: Omit<CartItem, 'cantidad'>, cantidad: number) => void
  modoPrecio: 'markup' | 'descuento'
  redondeo: number
  tramosDescuento: TramoDescuento[]
  theme: ComercioTheme
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
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: theme.cardBg, border: `1.5px solid ${theme.cardBorder}` }}
    >
      <Link href={`/comercios/producto/${p.id}`} className="contents">
        <div className="relative m-3 rounded-xl aspect-[4/5]" style={{ backgroundColor: theme.imagePlate }}>
          {imgUrl ? (
            <Image src={imgUrl} alt={p.nombre} fill className="object-cover" unoptimized />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: '#B7AF9C' }}>Sin imagen</div>
          )}

          {(p.is_featured || p.is_immediate_delivery || p.is_best_seller) && (
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {p.is_featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                  <Star className="w-3 h-3 fill-current" />Nuevo
                </span>
              )}
              {p.is_immediate_delivery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                  <Zap className="w-3 h-3 fill-current" />Inmediata
                </span>
              )}
              {p.is_best_seller && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                  <Award className="w-3 h-3" />Top
                </span>
              )}
            </div>
          )}

          {maxDescuento > 0 && (
            <span
              className="absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-bold shadow-md"
              style={{ backgroundColor: theme.savings, color: '#fff' }}
            >
              Hasta −{maxDescuento}%
            </span>
          )}
        </div>

        <div className="px-4 pt-1 flex flex-col gap-1.5">
          {p.marca && (
            <p className="text-[10px] font-semibold uppercase tracking-widest truncate" style={{ color: theme.textFaint }}>{p.marca}</p>
          )}
          <p className="text-lg font-semibold leading-snug line-clamp-2" style={{ color: theme.textPrimary }}>{p.nombre}</p>

          <p className="text-2xl font-extrabold mt-1" style={{ color: descuentoAplicado ? theme.savings : theme.accent }}>
            {!descuentoAplicado && (
              <span className="text-xs font-normal mr-1" style={{ color: theme.textFaint }}>Minorista:</span>
            )}
            ${precioUnitario.toLocaleString('es-AR')}
          </p>

          <div className="flex flex-wrap gap-1.5 mt-0.5">
            {p.unidades_por_bulto && (
              <span className="text-xs rounded px-2 py-1" style={{ backgroundColor: theme.accentTint(0.08), color: theme.textMuted }}>
                Bulto x{p.unidades_por_bulto}
              </span>
            )}
            {p.cantidad_minima && (
              <span className="text-xs rounded px-2 py-1" style={{ backgroundColor: theme.accentTint(0.12), color: theme.accent }}>
                Mín. {p.cantidad_minima} u.
              </span>
            )}
          </div>
        </div>
      </Link>

      {!p.is_on_demand && (
        <div className="flex items-center justify-center px-4 py-2 min-h-[28px]">
          {p.stock <= 5 ? (
            <p className="text-sm font-bold flex items-center gap-1.5" style={{ color: theme.urgency }}>
              <Package className="h-4 w-4" />
              ¡Últimas {p.stock} unidades!
            </p>
          ) : (
            <p className="text-sm flex items-center gap-1.5" style={{ color: theme.textMuted }}>
              <Package className="h-4 w-4" />
              Stock: <strong style={{ color: theme.textPrimary }}>{p.stock}</strong> u.
            </p>
          )}
        </div>
      )}

      <div className="px-4 pb-4 pt-2 flex flex-col gap-2 mt-auto">
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setCantidad(c => Math.max(1, c - 1))}
            className="w-9 h-9 rounded-lg text-sm font-medium"
            style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
          >−</button>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-16 text-center rounded-lg text-sm py-1.5 focus:outline-none"
            style={{ backgroundColor: 'transparent', border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
          />
          <button
            onClick={() => setCantidad(c => c + 1)}
            className="w-9 h-9 rounded-lg text-sm font-medium"
            style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
          >+</button>
        </div>

        {faltan > 0 ? (
          <p className="text-xs font-medium text-center" style={{ color: '#E8C15A' }}>
            Te faltan {faltan} u. para el mínimo de {p.cantidad_minima}
          </p>
        ) : (
          <button
            onClick={handleAdd}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold py-3 transition-colors"
            style={added
              ? { backgroundColor: theme.buttonAddedBg, color: theme.accent, border: `1.5px solid ${theme.accent}` }
              : { backgroundColor: theme.buttonBg, color: theme.buttonText, border: `1.5px solid ${theme.buttonBorder}` }}
          >
            {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {added ? 'Agregado' : 'Agregar al pedido'}
          </button>
        )}
      </div>
    </div>
  )
}
