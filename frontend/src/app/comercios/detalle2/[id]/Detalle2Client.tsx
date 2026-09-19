'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Star, Zap, Award, Package } from 'lucide-react'
import { useComercioCart } from '@/hooks/useComercioCart'
import { useComercioTheme } from '@/hooks/useComercioTheme'
import { getComercioTheme, getTramoScaleColor } from '@/lib/comercio-theme'
import { resolveImageUrl } from '@/lib/api'
import { calcularPrecioPorDescuento, type TramoDescuento } from '@/lib/precios-comercio'
import { parseDescripcionConIconos } from '@/lib/comercio-icons'
import { SavingsBar } from '../../_components/SavingsBar'
import type { ComercioIconItem } from '@/types'

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
  descripcion: string | null
  iconos: ComercioIconItem[] | null
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

export function Detalle2Client({ producto: p }: { producto: ProductoDetalle }) {
  const themeMode = useComercioTheme(s => s.mode)
  const theme = getComercioTheme(themeMode)
  const isDark = themeMode === 'dark'

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
  const descuentoAplicado = enModoDescuento && precioUnitario < (p.precio_venta as number)

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

  const stockBajo = !p.is_on_demand && p.stock <= 5

  const datosConcretos: { label: string; value: string; urgent?: boolean }[] = []
  if (p.sku) datosConcretos.push({ label: 'Código', value: p.sku })
  if (p.unidades_por_bulto) datosConcretos.push({ label: 'Bulto', value: `x${p.unidades_por_bulto} u.` })
  if (p.cantidad_minima) datosConcretos.push({ label: 'Compra mínima', value: `${p.cantidad_minima} u.` })
  if (!p.is_on_demand) {
    datosConcretos.push({
      label: 'Stock disponible',
      value: stockBajo ? `¡Últimas ${p.stock}!` : `${p.stock} u.`,
      urgent: stockBajo,
    })
  }

  return (
    <div className="relative overflow-x-hidden" style={{ backgroundColor: theme.pageBg, minHeight: 'calc(100vh - 60px)' }}>
      {/* Glow decorativo — solo en tema oscuro */}
      <div
        className="pointer-events-none absolute -top-24 -right-32 w-[520px] h-[520px] rounded-full"
        style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 68%)`, filter: 'blur(10px)', opacity: 0.25 * theme.glowOpacity }}
      />

      <div className="px-4 sm:px-6 lg:px-8">
      <div
        className="card-3d relative mx-auto my-4 sm:my-6 lg:my-8 max-w-6xl"
        style={{
          ...({
            '--shadow-color': isDark ? 'rgba(0,0,0,0.6)' : 'rgba(13,27,42,0.22)',
            '--shadow-color-soft': isDark ? 'rgba(0,0,0,0.4)' : 'rgba(13,27,42,0.12)',
          } as React.CSSProperties),
        }}
      >
      <div className="rounded-[1.75rem] overflow-hidden md:flex md:flex-col" style={{ backgroundColor: theme.cardBg }}>
        <div className="px-5 sm:px-8 md:px-10 py-3 shrink-0">
          <Link href="/comercios/catalogo3" className="text-sm hover:underline" style={{ color: theme.textMuted }}>
            ← Catálogo
          </Link>
        </div>

        <div className="md:grid md:grid-cols-2 md:items-start">
          {/* Galería tipo carousel — mismo tamaño de imagen que la tarjeta del catálogo */}
          <div className="flex flex-col gap-3 p-4 sm:p-6 md:p-8">
            <div className="relative w-full max-w-md mx-auto">
              <div
                className="relative aspect-[4/5] rounded-2xl overflow-hidden"
                style={{ backgroundColor: theme.imagePlate }}
              >
                {actual ? (
                  <Image
                    src={resolveImageUrl(actual.url) ?? actual.url}
                    alt={actual.alt_text || p.nombre}
                    fill
                    className="object-contain"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-sm" style={{ color: '#B7AF9C' }}>Sin imagen</div>
                )}
              </div>

              {imagenes.length > 1 && (
                <>
                  <button
                    onClick={goToPrev}
                    className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white transition-colors"
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft className="h-5 w-5" style={{ color: '#0D1B2A' }} />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md hover:bg-white transition-colors"
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight className="h-5 w-5" style={{ color: '#0D1B2A' }} />
                  </button>
                </>
              )}
            </div>

            {imagenes.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {imagenes.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setIndex(i)}
                    aria-label={`Ir a la imagen ${i + 1}`}
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

            {p.video_url && (
              <div className="rounded-xl overflow-hidden bg-black aspect-video shrink-0">
                <video
                  src={resolveImageUrl(p.video_url) ?? p.video_url}
                  controls
                  className="w-full h-full object-contain"
                  preload="metadata"
                />
              </div>
            )}

            {/* Características: datos concretos, descripción y contenido del kit */}
            {datosConcretos.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {datosConcretos.map(d => (
                  <div
                    key={d.label}
                    className="rounded-lg px-3 py-2"
                    style={d.urgent
                      ? { backgroundColor: theme.urgencyTint(0.08), border: `1.5px solid ${theme.urgencyTint(0.4)}` }
                      : { backgroundColor: theme.accentTint(0.05), border: `1.5px solid ${theme.inputBorder}` }}
                  >
                    <p className="text-[10px] uppercase tracking-wide font-semibold" style={{ color: d.urgent ? theme.urgency : theme.textFaint }}>{d.label}</p>
                    <p className="text-sm font-bold" style={{ color: d.urgent ? theme.urgency : theme.textPrimary }}>{d.value}</p>
                  </div>
                ))}
              </div>
            )}

            {p.descripcion && (
              <div
                className="rounded-xl px-4 py-3 space-y-2"
                style={{ backgroundColor: theme.accentTint(0.05), border: `1.5px solid ${theme.inputBorder}` }}
              >
                {parseDescripcionConIconos(p.descripcion, p.iconos).map((line, index) =>
                  line.isBullet ? (
                    <div key={index} className="flex items-start gap-2">
                      {line.icon ? (
                        <line.icon className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme.accent }} />
                      ) : (
                        <span
                          className="h-1.5 w-1.5 rounded-full shrink-0 mt-[7px]"
                          style={{ backgroundColor: theme.textMuted }}
                        />
                      )}
                      <p className="text-sm" style={{ color: theme.textPrimary }}>{line.text}</p>
                    </div>
                  ) : (
                    <p key={index} className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{line.text}</p>
                  )
                )}
              </div>
            )}

            {p.kit_content && (
              <div
                className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                style={{ backgroundColor: theme.accentTint(0.05), border: `1.5px solid ${theme.inputBorder}` }}
              >
                <Package className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme.textMuted }} />
                <div>
                  <p className="text-xs font-semibold mb-0.5" style={{ color: theme.textMuted }}>Contenido</p>
                  <p className="text-sm whitespace-pre-line" style={{ color: theme.textMuted }}>{p.kit_content}</p>
                </div>
              </div>
            )}
          </div>

          {/* Info — título, precio, matriz de descuentos y compra a la derecha */}
          <div className="p-4 sm:p-6 md:p-8 flex flex-col">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-xs mb-1.5" style={{ color: theme.textMuted }}>
                {p.categoria && <span>{p.categoria}</span>}
                {p.categoria && p.marca && <span>•</span>}
                {p.marca && <span className="font-medium" style={{ color: theme.textMuted }}>{p.marca}</span>}
              </div>

              <h1 className="text-2xl md:text-3xl font-bold mb-2" style={{ color: theme.textPrimary }}>{p.nombre}</h1>

              {(p.is_featured || p.is_immediate_delivery || p.is_best_seller) && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.is_featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                      <Star className="w-2.5 h-2.5 fill-current" /> Nuevo
                    </span>
                  )}
                  {p.is_immediate_delivery && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                      <Zap className="w-2.5 h-2.5 fill-current" /> Inmediata
                    </span>
                  )}
                  {p.is_best_seller && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                      <Award className="w-2.5 h-2.5" /> Top
                    </span>
                  )}
                </div>
              )}

              <div className="mb-4">
                <p className="text-3xl md:text-4xl font-extrabold" style={{ color: descuentoAplicado ? theme.savings : theme.accent }}>
                  ${precioUnitario.toLocaleString('es-AR')}
                </p>
                {enModoDescuento && (
                  <p className="text-xs mt-0.5" style={{ color: theme.textFaint }}>
                    Precio de lista ${(p.precio_venta as number).toLocaleString('es-AR')} — se recalcula según la cantidad
                  </p>
                )}
              </div>

              {enModoDescuento && p.tramos_descuento.length > 0 && (
                <div className="mb-4 rounded-xl overflow-hidden" style={{ backgroundColor: theme.accentTint(0.05), border: `1.5px solid ${theme.accentTint(0.25)}` }}>
                  <div className="px-4 pt-3 pb-2">
                    <SavingsBar
                      precioVenta={p.precio_venta as number}
                      cantidad={cantidad}
                      tramos={p.tramos_descuento}
                      redondeo={p.redondeo}
                      theme={theme}
                    />
                  </div>
                  <div style={{ height: 1, backgroundColor: theme.accentTint(0.2) }} />
                  <table className="w-full text-sm">
                    <tbody>
                      {(() => {
                        const maxDescuento = Math.max(...p.tramos_descuento.map(t => t.descuento_porcentaje))
                        return p.tramos_descuento.map(t => {
                          const activo = cantidad >= t.cantidad_minima
                            && !p.tramos_descuento.some(o => o.cantidad_minima > t.cantidad_minima && o.cantidad_minima <= cantidad)
                          const colorTramo = getTramoScaleColor(maxDescuento > 0 ? t.descuento_porcentaje / maxDescuento : 0)
                          return (
                            <tr key={t.cantidad_minima} style={activo ? { backgroundColor: theme.accent } : undefined}>
                              <td className="px-4 py-2 font-medium" style={{ color: activo ? theme.buttonBg : theme.textMuted }}>{t.cantidad_minima}+ u.</td>
                              <td className="py-2 font-bold" style={{ color: activo ? theme.buttonBg : colorTramo }}>−{t.descuento_porcentaje}%</td>
                              <td className="px-4 py-2 text-right font-bold" style={{ color: activo ? theme.buttonBg : theme.textPrimary }}>
                                ${calcularPrecioPorDescuento(p.precio_venta as number, t.cantidad_minima, p.tramos_descuento, p.redondeo).toLocaleString('es-AR')}
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

            <div className="shrink-0 pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: theme.textMuted }}>Cantidad</span>
                <div className="flex items-center gap-1.5">
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
            </div>
          </div>
        </div>
      </div>
      </div>
      </div>
    </div>
  )
}
