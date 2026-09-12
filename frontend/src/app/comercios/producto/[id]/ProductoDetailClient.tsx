'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Star, Zap, Award, Package } from 'lucide-react'
import { useComercioCart } from '@/hooks/useComercioCart'
import { resolveImageUrl } from '@/lib/api'
import { calcularPrecioPorDescuento, type TramoDescuento } from '@/lib/precios-comercio'

interface Imagen {
  id: number
  url: string
  alt_text: string | null
}

interface ProductoDetalle {
  id: number
  nombre: string
  marca: string | null
  sku: string | null
  categoria: string | null
  subcategoria: string | null
  kit_content: string | null
  unidades_por_bulto: number | null
  cantidad_minima: number | null
  precio_comercio: number
  precio_venta: number | null
  stock: number
  is_on_demand: boolean
  video_url: string | null
  imagenes: Imagen[]
  is_featured: boolean
  is_immediate_delivery: boolean
  is_best_seller: boolean
  modo_precio: 'markup' | 'descuento'
  redondeo: number
  tramos_descuento: TramoDescuento[]
  override: boolean
}

export function ProductoDetailClient({ producto: p }: { producto: ProductoDetalle }) {
  const [index, setIndex] = useState(0)
  const [cantidad, setCantidad] = useState(p.cantidad_minima || 1)
  const [added, setAdded] = useState(false)
  const add = useComercioCart(s => s.add)
  const setPricingConfig = useComercioCart(s => s.setPricingConfig)

  useEffect(() => {
    setPricingConfig({ modo_precio: p.modo_precio, redondeo: p.redondeo, tramos_descuento: p.tramos_descuento })
  }, [p.modo_precio, p.redondeo, p.tramos_descuento, setPricingConfig])

  const imagenes = p.imagenes
  const actual = imagenes[index]

  const enModoDescuento = p.modo_precio === 'descuento' && p.precio_venta != null && !p.override
  const precioUnitario = enModoDescuento
    ? calcularPrecioPorDescuento(p.precio_venta as number, cantidad, p.tramos_descuento, p.redondeo)
    : p.precio_comercio

  const faltan = p.cantidad_minima ? Math.max(0, p.cantidad_minima - cantidad) : 0

  function goToPrev() {
    if (imagenes.length < 2) return
    setIndex(i => (i - 1 + imagenes.length) % imagenes.length)
  }

  function goToNext() {
    if (imagenes.length < 2) return
    setIndex(i => (i + 1) % imagenes.length)
  }

  function handleAdd() {
    add(
      {
        producto_id: p.id,
        nombre: p.nombre,
        imagen_url: actual?.url ?? null,
        precio_comercio: p.precio_comercio,
        precio_venta: p.precio_venta,
        cantidad_minima: p.cantidad_minima,
      },
      cantidad,
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const datosConcretos: { label: string; value: string }[] = []
  if (p.sku) datosConcretos.push({ label: 'Código', value: p.sku })
  if (p.unidades_por_bulto) datosConcretos.push({ label: 'Bulto', value: `x${p.unidades_por_bulto} u.` })
  if (p.cantidad_minima) datosConcretos.push({ label: 'Compra mínima', value: `${p.cantidad_minima} u.` })
  if (!p.is_on_demand) datosConcretos.push({ label: 'Stock disponible', value: `${p.stock} u.` })

  return (
    <div>
      <Link href="/comercios/catalogo" className="text-sm text-zinc-500 hover:underline">
        ← Catálogo
      </Link>

      <div className="mt-4 bg-white rounded-2xl border border-zinc-200/80 shadow-sm grid md:grid-cols-2 gap-0 overflow-hidden">
        {/* Galería */}
        <div className="p-4 md:p-6 space-y-3">
          <div className="aspect-square relative rounded-xl overflow-hidden bg-zinc-50 border border-zinc-100 group">
            {actual ? (
              <Image
                src={resolveImageUrl(actual.url) ?? actual.url}
                alt={actual.alt_text || p.nombre}
                fill
                className="object-contain"
                priority
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-300 text-sm">Sin imagen</div>
            )}

            {imagenes.length > 1 && (
              <>
                <button
                  onClick={goToPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-md border border-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  aria-label="Imagen anterior"
                >
                  <ChevronLeft className="h-4 w-4 text-zinc-700" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-md border border-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                  aria-label="Imagen siguiente"
                >
                  <ChevronRight className="h-4 w-4 text-zinc-700" />
                </button>
              </>
            )}
          </div>

          {imagenes.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {imagenes.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setIndex(i)}
                  className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                    i === index ? 'border-primary-500' : 'border-zinc-200 hover:border-zinc-300'
                  }`}
                >
                  <Image
                    src={resolveImageUrl(img.url) ?? img.url}
                    alt={img.alt_text || `${p.nombre} - ${i + 1}`}
                    width={56}
                    height={56}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {p.video_url && (
            <div className="rounded-xl overflow-hidden bg-black aspect-video">
              <video
                src={resolveImageUrl(p.video_url) ?? p.video_url}
                controls
                className="w-full h-full object-contain"
                preload="metadata"
              />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-4 md:p-6 border-t md:border-t-0 md:border-l border-zinc-100 flex flex-col">
          <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
            {p.categoria && <span>{p.categoria}</span>}
            {p.categoria && p.marca && <span>•</span>}
            {p.marca && <span className="font-medium text-zinc-600">{p.marca}</span>}
          </div>

          <h1 className="text-xl font-bold text-zinc-900 mb-2">{p.nombre}</h1>

          {(p.is_featured || p.is_immediate_delivery || p.is_best_seller) && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {p.is_featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                  <Star className="w-2.5 h-2.5 fill-current" /> Nuevo
                </span>
              )}
              {p.is_immediate_delivery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                  <Zap className="w-2.5 h-2.5 fill-current" /> Inmediata
                </span>
              )}
              {p.is_best_seller && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                  <Award className="w-2.5 h-2.5" /> Top
                </span>
              )}
            </div>
          )}

          <div className="mb-4">
            <p className="text-2xl font-extrabold text-zinc-900">
              ${precioUnitario.toLocaleString('es-AR')}
            </p>
            {enModoDescuento && (
              <p className="text-xs text-zinc-400 mt-0.5">
                Precio de lista ${(p.precio_venta as number).toLocaleString('es-AR')} — se recalcula según la cantidad
              </p>
            )}
          </div>

          {datosConcretos.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mb-4">
              {datosConcretos.map(d => (
                <div key={d.label} className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-zinc-400 font-semibold">{d.label}</p>
                  <p className="text-sm font-semibold text-zinc-800">{d.value}</p>
                </div>
              ))}
            </div>
          )}

          {p.kit_content && (
            <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 flex items-start gap-2.5">
              <Package className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-zinc-700 mb-0.5">Contenido</p>
                <p className="text-sm text-zinc-600 whitespace-pre-line">{p.kit_content}</p>
              </div>
            </div>
          )}

          {enModoDescuento && p.tramos_descuento.length > 0 && (
            <div className="mb-4 rounded-xl border border-zinc-200 overflow-hidden">
              <p className="text-xs font-semibold text-zinc-700 bg-zinc-50 px-3 py-2 border-b border-zinc-200">
                Descuento por cantidad
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-zinc-400 text-xs">
                    <th className="text-left font-medium px-3 py-1.5">Cantidad</th>
                    <th className="text-left font-medium px-3 py-1.5">Descuento</th>
                    <th className="text-right font-medium px-3 py-1.5">Precio</th>
                  </tr>
                </thead>
                <tbody>
                  {p.tramos_descuento.map(t => {
                    const activo = cantidad >= t.cantidad_minima
                      && !p.tramos_descuento.some(o => o.cantidad_minima > t.cantidad_minima && o.cantidad_minima <= cantidad)
                    return (
                      <tr key={t.cantidad_minima} className={`border-t border-zinc-100 ${activo ? 'bg-primary-50' : ''}`}>
                        <td className="px-3 py-1.5 text-zinc-700">{t.cantidad_minima}+ u.</td>
                        <td className="px-3 py-1.5 text-emerald-600 font-medium">{t.descuento_porcentaje}%</td>
                        <td className="px-3 py-1.5 text-right font-semibold text-zinc-900">
                          ${calcularPrecioPorDescuento(p.precio_venta as number, t.cantidad_minima, p.tramos_descuento, p.redondeo).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-auto pt-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-600">Cantidad</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCantidad(c => Math.max(1, c - 1))}
                  className="w-8 h-8 border border-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={cantidad}
                  onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 text-center border border-zinc-300 rounded-lg text-sm py-1 focus:outline-none"
                />
                <button
                  onClick={() => setCantidad(c => c + 1)}
                  className="w-8 h-8 border border-zinc-300 rounded-lg text-sm font-medium hover:bg-zinc-50"
                >
                  +
                </button>
              </div>
            </div>

            {faltan > 0 ? (
              <p className="text-sm text-amber-600 font-medium text-center bg-amber-50 border border-amber-100 rounded-xl py-3">
                Te faltan {faltan} u. para el mínimo de {p.cantidad_minima}
              </p>
            ) : (
              <button
                onClick={handleAdd}
                className={`w-full flex items-center justify-center gap-2 rounded-xl border-2 font-semibold py-3 transition-colors ${
                  added
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-700'
                }`}
              >
                {added ? <Check className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
                {added ? 'Agregado al pedido' : 'Agregar al pedido'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
