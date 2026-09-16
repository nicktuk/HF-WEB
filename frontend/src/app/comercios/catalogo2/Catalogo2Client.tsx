'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Star, Zap, Award, Package } from 'lucide-react'
import { useComercioCart, CartItem } from '@/hooks/useComercioCart'
import { useComercioTheme } from '@/hooks/useComercioTheme'
import { getComercioTheme } from '@/lib/comercio-theme'
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

export function Catalogo2Client({ productos, montoMinimo, modoPrecio, redondeo, tramosDescuento }: Props) {
  const themeMode = useComercioTheme(s => s.mode)
  const theme = getComercioTheme(themeMode)

  const add = useComercioCart(s => s.add)
  const setPricingConfig = useComercioCart(s => s.setPricingConfig)

  useEffect(() => {
    setPricingConfig({ modo_precio: modoPrecio, redondeo, tramos_descuento: tramosDescuento })
  }, [modoPrecio, redondeo, tramosDescuento, setPricingConfig])

  const [index, setIndex] = useState(0)
  const [cantidades, setCantidades] = useState<Record<number, number>>({})
  const [addedId, setAddedId] = useState<number | null>(null)

  const p = productos[index]
  const cantidad = p ? (cantidades[p.id] ?? p.cantidad_minima ?? 1) : 1

  function setCantidad(id: number, value: number) {
    setCantidades(c => ({ ...c, [id]: Math.max(1, value) }))
  }

  function goPrev() {
    setIndex(i => (i - 1 + productos.length) % productos.length)
  }
  function goNext() {
    setIndex(i => (i + 1) % productos.length)
  }

  if (productos.length === 0) {
    return (
      <div className="relative" style={{ backgroundColor: theme.pageBg, minHeight: 'calc(100vh - 60px)' }}>
        <p className="p-8 text-sm" style={{ color: theme.textMuted }}>Todavía no hay productos cargados.</p>
      </div>
    )
  }

  const imgUrl = resolveImageUrl(p.imagen_url)
  const faltan = p.cantidad_minima ? Math.max(0, p.cantidad_minima - cantidad) : 0
  const enModoDescuento = modoPrecio === 'descuento' && p.precio_venta != null

  const precioUnitario = enModoDescuento
    ? calcularPrecioPorDescuento(p.precio_venta as number, cantidad, tramosDescuento, redondeo)
    : p.precio_comercio
  const descuentoAplicado = enModoDescuento && precioUnitario < (p.precio_venta as number)
  const added = addedId === p.id

  function handleAdd() {
    add(
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
    setAddedId(p.id)
    setTimeout(() => setAddedId(null), 1500)
  }

  return (
    <div className="relative overflow-x-hidden flex flex-col items-center justify-center" style={{ backgroundColor: theme.pageBg, minHeight: 'calc(100vh - 60px)' }}>
      <div className="w-full max-w-md px-5 py-6 flex flex-col gap-4">

        {montoMinimo > 0 && (
          <div
            className="rounded-2xl px-4 py-2.5 text-xs text-center"
            style={{ backgroundColor: theme.accentTint(0.1), border: `1.5px solid ${theme.accentTint(0.3)}`, color: theme.accent }}
          >
            Pedido mínimo: <strong>${montoMinimo.toLocaleString('es-AR')}</strong>
          </div>
        )}

        {/* Imagen con navegación */}
        <div className="relative rounded-2xl overflow-hidden aspect-[4/5] group" style={{ backgroundColor: theme.imagePlate }}>
          {imgUrl ? (
            <Image src={imgUrl} alt={p.nombre} fill className="object-contain" unoptimized priority />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: '#B7AF9C' }}>Sin imagen</div>
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

          {productos.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white transition-colors"
                aria-label="Producto anterior"
              >
                <ChevronLeft className="h-5 w-5" style={{ color: '#0D1B2A' }} />
              </button>
              <button
                onClick={goNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white transition-colors"
                aria-label="Producto siguiente"
              >
                <ChevronRight className="h-5 w-5" style={{ color: '#0D1B2A' }} />
              </button>
            </>
          )}
        </div>

        {/* Info */}
        <div>
          {p.marca && (
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: theme.textFaint }}>{p.marca}</p>
          )}
          <h1 className="text-xl font-bold mb-2" style={{ color: theme.textPrimary }}>{p.nombre}</h1>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-extrabold" style={{ color: descuentoAplicado ? theme.savings : theme.accent }}>
              ${precioUnitario.toLocaleString('es-AR')}
            </span>
            {(p.unidades_por_bulto || p.cantidad_minima) && (
              <span className="text-xs" style={{ color: theme.textMuted }}>
                {p.unidades_por_bulto && `Bulto x${p.unidades_por_bulto}`}
                {p.unidades_por_bulto && p.cantidad_minima && ' · '}
                {p.cantidad_minima && `Mín. ${p.cantidad_minima} u.`}
              </span>
            )}
          </div>

          {!p.is_on_demand && (
            <div className="flex items-center gap-1.5 text-xs" style={{ color: p.stock <= 5 ? theme.urgency : theme.textMuted }}>
              <Package className="h-3.5 w-3.5" />
              {p.stock <= 5 ? (
                <span className="font-bold">¡Últimas {p.stock} unidades!</span>
              ) : (
                <span>Stock: <strong style={{ color: theme.textPrimary }}>{p.stock}</strong> u.</span>
              )}
            </div>
          )}
        </div>

        {/* Cantidad + agregar */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setCantidad(p.id, cantidad - 1)}
              className="w-9 h-9 rounded-lg text-sm font-medium"
              style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
            >−</button>
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={e => setCantidad(p.id, parseInt(e.target.value) || 1)}
              className="w-16 text-center rounded-lg text-sm py-1.5 focus:outline-none"
              style={{ backgroundColor: 'transparent', border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
            />
            <button
              onClick={() => setCantidad(p.id, cantidad + 1)}
              className="w-9 h-9 rounded-lg text-sm font-medium"
              style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
            >+</button>
          </div>

          {faltan > 0 ? (
            <p
              className="text-sm font-medium text-center rounded-xl py-3"
              style={{ color: '#E8C15A', backgroundColor: 'rgba(232,193,90,0.1)', border: '1.5px solid rgba(232,193,90,0.3)' }}
            >
              Te faltan {faltan} u. para el mínimo de {p.cantidad_minima}
            </p>
          ) : (
            <button
              onClick={handleAdd}
              className="w-full flex items-center justify-center gap-2 rounded-xl font-semibold py-3 transition-colors"
              style={added
                ? { backgroundColor: theme.buttonAddedBg, color: theme.accent, border: `1.5px solid ${theme.accent}` }
                : { backgroundColor: theme.buttonBg, color: theme.buttonText, border: `1.5px solid ${theme.buttonBorder}` }}
            >
              {added ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
              {added ? 'Agregado al pedido' : 'Agregar al pedido'}
            </button>
          )}

          {productos.length > 1 && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap">
              {productos.map((prod, i) => (
                <button
                  key={prod.id}
                  onClick={() => setIndex(i)}
                  aria-label={`Ir a ${prod.nombre}`}
                  className="rounded-full transition-all"
                  style={{
                    width: i === index ? 18 : 6,
                    height: 6,
                    backgroundColor: i === index ? theme.accent : theme.accentTint(0.25),
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
