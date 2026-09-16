'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Star, Zap, Award } from 'lucide-react'
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

export function Catalogo3Client({ productos, montoMinimo, modoPrecio, redondeo, tramosDescuento }: Props) {
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
      <div style={{ backgroundColor: theme.pageBg, minHeight: 'calc(100vh - 60px)' }}>
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
    <div className="relative overflow-hidden" style={{ backgroundColor: theme.pageBg, height: 'calc(100vh - 60px)' }}>
      {/* Fondo neutro (mismo tono que usa el resto de la app para fotos de producto) */}
      <div className="absolute inset-0" style={{ backgroundColor: theme.imagePlate }} />

      {/* Foto completa del producto, centrada y sin cortar */}
      <div className="absolute inset-0 flex items-center justify-center px-6" style={{ paddingTop: 210, paddingBottom: 168 }}>
        <div className="relative w-full h-full">
          {imgUrl && (
            <Image src={imgUrl} alt={p.nombre} fill className="object-contain" unoptimized priority />
          )}
        </div>
      </div>

      {/* Scrim superior: se funde con el header y se aclara justo antes de la foto */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 h-60" style={{ background: `linear-gradient(180deg, ${theme.pageBg} 0%, ${theme.pageBg} 85%, transparent 100%)` }} />

      {/* Barra de progreso tipo historia */}
      {productos.length > 1 && (
        <div className="absolute top-3 left-3 right-3 flex gap-1 z-10">
          {productos.map((prod, i) => (
            <button
              key={prod.id}
              onClick={() => setIndex(i)}
              aria-label={`Ir a ${prod.nombre}`}
              className="flex-1 h-[3px] rounded-full"
              style={{ backgroundColor: i <= index ? theme.accent : theme.accentTint(0.2) }}
            />
          ))}
        </div>
      )}

      {montoMinimo > 0 && (
        <div
          className="absolute top-8 left-3 right-3 rounded-xl px-3 py-2 text-xs text-center z-10"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff' }}
        >
          Pedido mínimo: <strong>${montoMinimo.toLocaleString('es-AR')}</strong>
        </div>
      )}

      {/* Identidad del producto: nombre y precio arriba, junto con los badges */}
      <div className="absolute top-16 left-4 right-4 z-10 flex flex-col gap-2">
        {(p.is_featured || p.is_immediate_delivery || p.is_best_seller) && (
          <div className="flex flex-wrap gap-1.5">
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

        {p.marca && (
          <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: theme.textMuted }}>{p.marca}</p>
        )}
        <h1 className="text-xl font-bold leading-snug -mt-1" style={{ color: theme.textPrimary }}>{p.nombre}</h1>
        <span className="text-2xl font-extrabold" style={{ color: descuentoAplicado ? theme.savings : theme.accent }}>
          ${precioUnitario.toLocaleString('es-AR')}
        </span>
      </div>

      {productos.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full z-10"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            aria-label="Producto anterior"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-full z-10"
            style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            aria-label="Producto siguiente"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        </>
      )}

      {/* Panel inferior: solo cantidad y agregar */}
      <div
        className="absolute left-0 right-0 bottom-0 px-5 pt-16 pb-6 flex flex-col gap-2.5"
        style={{ background: `linear-gradient(180deg, transparent 0%, ${theme.pageBg} 55%, ${theme.pageBg} 100%)` }}
      >
        <p className="text-xs text-center" style={{ color: theme.textMuted }}>
          {p.unidades_por_bulto && `Bulto x${p.unidades_por_bulto}`}
          {p.unidades_por_bulto && p.cantidad_minima && ' · '}
          {p.cantidad_minima && `Mín. ${p.cantidad_minima} u.`}
          {!p.is_on_demand && ` · Stock ${p.stock} u.`}
        </p>

        {faltan > 0 ? (
          <p
            className="text-sm font-medium text-center rounded-xl py-2.5"
            style={{ color: '#E8C15A', backgroundColor: 'rgba(232,193,90,0.15)', border: '1.5px solid rgba(232,193,90,0.35)' }}
          >
            Te faltan {faltan} u. para el mínimo de {p.cantidad_minima}
          </p>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setCantidad(p.id, cantidad - 1)}
                className="w-9 h-9 rounded-lg text-sm font-medium"
                style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
              >−</button>
              <div
                className="w-10 h-9 rounded-lg flex items-center justify-center text-sm"
                style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
              >
                {cantidad}
              </div>
              <button
                onClick={() => setCantidad(p.id, cantidad + 1)}
                className="w-9 h-9 rounded-lg text-sm font-medium"
                style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
              >+</button>
            </div>
            <button
              onClick={handleAdd}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl font-semibold py-2.5 text-sm transition-colors"
              style={added
                ? { backgroundColor: theme.buttonAddedBg, color: theme.accent, border: `1.5px solid ${theme.accent}` }
                : { backgroundColor: theme.buttonBg, color: theme.buttonText, border: `1.5px solid ${theme.buttonBorder}` }}
            >
              {added ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
              {added ? 'Agregado' : 'Agregar al pedido'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
