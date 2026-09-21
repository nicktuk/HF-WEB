'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ShoppingCart, Check, Star, Zap, Award, Package, Lock } from 'lucide-react'
import { useComercioCart } from '@/hooks/useComercioCart'
import { useComercioTheme } from '@/hooks/useComercioTheme'
import { getComercioTheme, getTramoScaleColorV2 } from '@/lib/comercio-theme'
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

/** Datos públicos (sin sesión): sin precio, stock ni galería completa. */
interface ProductoPreview {
  id: number
  nombre: string
  marca: string | null
  categoria: string | null
  imagen_url: string | null
  cantidad_minima: number | null
}

type Props =
  | { mode: 'full'; producto: ProductoDetalle; prevProductoId: number | null; nextProductoId: number | null }
  | { mode: 'preview'; producto: ProductoPreview; prevProductoId: number | null; nextProductoId: number | null }

/** Tarjeta con esquinas redondeadas y sombra 3D, sin borde (mismo tratamiento que catalogo3). */
function Card3D({ children, cardBg, isDark, className }: { children: React.ReactNode; cardBg: string; isDark: boolean; className?: string }) {
  return (
    <div
      className="card-3d"
      style={{
        ...({
          '--shadow-color': isDark ? 'rgba(0,0,0,0.6)' : 'rgba(13,27,42,0.22)',
          '--shadow-color-soft': isDark ? 'rgba(0,0,0,0.4)' : 'rgba(13,27,42,0.12)',
        } as React.CSSProperties),
      }}
    >
      <div className={`rounded-[1.75rem] overflow-hidden ${className ?? ''}`} style={{ backgroundColor: cardBg }}>
        {children}
      </div>
    </div>
  )
}

export function CatalogoClient(props: Props) {
  const { prevProductoId, nextProductoId } = props
  const full = props.mode === 'full' ? props : null
  const previewProducto = props.mode === 'preview' ? props.producto : null

  const themeMode = useComercioTheme(s => s.mode)
  const theme = getComercioTheme(themeMode)
  const isDark = themeMode === 'dark'

  const [index, setIndex] = useState(0)
  const [cantidad, setCantidad] = useState(full?.producto.cantidad_minima || 1)
  const [added, setAdded] = useState(false)
  const add = useComercioCart(s => s.add)
  const setPricingConfig = useComercioCart(s => s.setPricingConfig)

  useEffect(() => {
    if (!full) return
    setPricingConfig({ modo_precio: full.producto.modo_precio, redondeo: full.producto.redondeo, tramos_descuento: full.producto.tramos_descuento })
  }, [full, setPricingConfig])

  const imagenes: Imagen[] = full
    ? full.producto.imagenes
    : previewProducto?.imagen_url
      ? [{ id: 0, url: previewProducto.imagen_url, alt_text: previewProducto.nombre }]
      : []
  const actual = imagenes[index]

  const enModoDescuento = full ? full.producto.modo_precio === 'descuento' && full.producto.precio_venta != null && !full.producto.override : false
  const precioUnitario = full
    ? (enModoDescuento
      ? calcularPrecioPorDescuento(full.producto.precio_venta as number, cantidad, full.producto.tramos_descuento, full.producto.redondeo)
      : full.producto.precio_comercio)
    : 0
  const descuentoAplicado = !!full && enModoDescuento && precioUnitario < (full.producto.precio_venta as number)

  const faltan = full?.producto.cantidad_minima ? Math.max(0, full.producto.cantidad_minima - cantidad) : 0

  function goToPrev() {
    if (imagenes.length < 2) return
    setIndex(i => (i - 1 + imagenes.length) % imagenes.length)
  }

  function goToNext() {
    if (imagenes.length < 2) return
    setIndex(i => (i + 1) % imagenes.length)
  }

  function handleAdd() {
    if (!full) return
    add(
      {
        producto_id: full.producto.id,
        nombre: full.producto.nombre,
        imagen_url: actual?.url ?? null,
        precio_comercio: full.producto.precio_comercio,
        precio_venta: full.producto.precio_venta,
        cantidad_minima: full.producto.cantidad_minima,
      },
      cantidad,
    )
    setAdded(true)
    setTimeout(() => setAdded(false), 1500)
  }

  const datosConcretos: { label: string; value: string; urgent?: boolean }[] = []
  if (full) {
    const p = full.producto
    const stockBajo = !p.is_on_demand && p.stock <= 5
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
  } else if (previewProducto?.cantidad_minima) {
    datosConcretos.push({ label: 'Compra mínima', value: `${previewProducto.cantidad_minima} u.` })
  }

  return (
    <div className="relative overflow-x-hidden" style={{ backgroundColor: theme.pageBg, minHeight: 'calc(100vh - 60px)' }}>
      {/* Glow decorativo — solo en tema oscuro */}
      <div
        className="pointer-events-none absolute -top-24 -right-32 w-[520px] h-[520px] rounded-full"
        style={{ background: `radial-gradient(circle, ${theme.accent} 0%, transparent 68%)`, filter: 'blur(10px)', opacity: 0.25 * theme.glowOpacity }}
      />

      {/* Flechas flotantes fijas al centro de la pantalla — navegan al producto anterior/siguiente */}
      {prevProductoId != null && (
        <Link
          href={`/comercios/catalogo/${prevProductoId}`}
          className="fixed left-3 md:left-6 top-1/2 -translate-y-1/2 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg hover:bg-white transition-colors"
          aria-label="Producto anterior"
        >
          <ChevronLeft className="h-6 w-6" style={{ color: '#0D1B2A' }} />
        </Link>
      )}
      {nextProductoId != null && (
        <Link
          href={`/comercios/catalogo/${nextProductoId}`}
          className="fixed right-3 md:right-6 top-1/2 -translate-y-1/2 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg hover:bg-white transition-colors"
          aria-label="Producto siguiente"
        >
          <ChevronRight className="h-6 w-6" style={{ color: '#0D1B2A' }} />
        </Link>
      )}

      <div className="relative px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto py-4 sm:py-6 lg:py-8">
        {/* Nombre del producto: arriba de todo, antes de cualquier tarjeta */}
        <div className="mb-3 sm:mb-4">
          <div className="flex items-center gap-2 text-sm mb-1.5" style={{ color: theme.textMuted }}>
            {props.producto.categoria && <span>{props.producto.categoria}</span>}
            {props.producto.categoria && props.producto.marca && <span>•</span>}
            {props.producto.marca && <span className="font-medium" style={{ color: theme.textMuted }}>{props.producto.marca}</span>}
          </div>

          <h1 className="text-3xl md:text-4xl font-bold mb-2" style={{ color: theme.textPrimary }}>{props.producto.nombre}</h1>

          {full && (full.producto.is_featured || full.producto.is_immediate_delivery || full.producto.is_best_seller) && (
            <div className="flex flex-wrap gap-1.5">
              {full.producto.is_featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wide">
                  <Star className="w-2.5 h-2.5 fill-current" /> Nuevo
                </span>
              )}
              {full.producto.is_immediate_delivery && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wide">
                  <Zap className="w-2.5 h-2.5 fill-current" /> Inmediata
                </span>
              )}
              {full.producto.is_best_seller && (
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2 py-0.5 text-xs font-bold text-white uppercase tracking-wide">
                  <Award className="w-2.5 h-2.5" /> Top
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 items-start">
          {/* Columna izquierda: fotos + características, cada una en su tarjeta */}
          <div className="flex flex-col gap-4">
          <Card3D cardBg={theme.cardBg} isDark={isDark}>
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            <div className="w-full max-w-md mx-auto">
              <div className="relative aspect-square rounded-2xl overflow-hidden group">
                {actual ? (
                  <Image
                    src={resolveImageUrl(actual.url) ?? actual.url}
                    alt={actual.alt_text || props.producto.nombre}
                    fill
                    className="object-contain"
                    priority
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-base" style={{ color: '#B7AF9C' }}>Sin imagen</div>
                )}

                {imagenes.length > 1 && (
                  <>
                    <button
                      onClick={goToPrev}
                      className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeft className="h-4 w-4" style={{ color: '#0D1B2A' }} />
                    </button>
                    <button
                      onClick={goToNext}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                      aria-label="Imagen siguiente"
                    >
                      <ChevronRight className="h-4 w-4" style={{ color: '#0D1B2A' }} />
                    </button>
                  </>
                )}
              </div>

              {imagenes.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 mt-3">
                  {imagenes.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setIndex(i)}
                      className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors"
                      style={{ borderColor: i === index ? theme.accent : theme.inputBorder }}
                    >
                      <Image
                        src={resolveImageUrl(img.url) ?? img.url}
                        alt={img.alt_text || `${props.producto.nombre} - ${i + 1}`}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          </Card3D>

          {/* Características: datos concretos, descripción, contenido del kit y video — su propia tarjeta */}
          {(datosConcretos.length > 0 || full?.producto.descripcion || full?.producto.kit_content || full?.producto.video_url || !full) && (
          <Card3D cardBg={theme.cardBg} isDark={isDark}>
          <div className="flex flex-col gap-3 p-3 sm:p-4">
            {full?.producto.video_url && (
              <div className="rounded-xl overflow-hidden bg-black aspect-video shrink-0">
                <video
                  src={resolveImageUrl(full.producto.video_url) ?? full.producto.video_url}
                  controls
                  className="w-full h-full object-contain"
                  preload="metadata"
                />
              </div>
            )}

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
                    <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: d.urgent ? theme.urgency : theme.textFaint }}>{d.label}</p>
                    <p className="text-base font-bold" style={{ color: d.urgent ? theme.urgency : theme.textPrimary }}>{d.value}</p>
                  </div>
                ))}
              </div>
            )}

            {full?.producto.descripcion && (
              <div
                className="rounded-xl px-4 py-3 space-y-2"
                style={{ backgroundColor: theme.accentTint(0.05), border: `1.5px solid ${theme.inputBorder}` }}
              >
                {parseDescripcionConIconos(full.producto.descripcion, full.producto.iconos).map((line, index) =>
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
                      <p className="text-base" style={{ color: theme.textPrimary }}>{line.text}</p>
                    </div>
                  ) : (
                    <p key={index} className="text-base font-semibold" style={{ color: theme.textPrimary }}>{line.text}</p>
                  )
                )}
              </div>
            )}

            {full?.producto.kit_content && (
              <div
                className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                style={{ backgroundColor: theme.accentTint(0.05), border: `1.5px solid ${theme.inputBorder}` }}
              >
                <Package className="h-4 w-4 shrink-0 mt-0.5" style={{ color: theme.textMuted }} />
                <div>
                  <p className="text-sm font-semibold mb-0.5" style={{ color: theme.textMuted }}>Contenido</p>
                  <p className="text-base whitespace-pre-line" style={{ color: theme.textMuted }}>{full.producto.kit_content}</p>
                </div>
              </div>
            )}

            {!full && (
              <p className="text-sm text-center" style={{ color: theme.textFaint }}>
                Iniciá sesión para ver el resto de las fotos, la descripción y el contenido.
              </p>
            )}
          </div>
          </Card3D>
          )}
          </div>

          {/* Columna derecha: precio, matriz y cantidad+botón, todo en una sola tarjeta */}
          <div className="flex flex-col gap-4">
          <Card3D cardBg={theme.cardBg} isDark={isDark}>
          <div className="p-3 sm:p-4">
            {full ? (
              <>
                <p className="text-4xl md:text-5xl font-extrabold" style={{ color: descuentoAplicado ? theme.savings : theme.accent }}>
                  ${precioUnitario.toLocaleString('es-AR')}
                </p>
                {enModoDescuento && (
                  <p className="text-sm mt-0.5" style={{ color: theme.textFaint }}>
                    Precio de venta sugerido ${(full.producto.precio_venta as number).toLocaleString('es-AR')} — se recalcula según la cantidad
                  </p>
                )}
              </>
            ) : (
              <div
                className="flex items-center gap-2 text-base font-semibold"
                style={{ color: theme.textMuted }}
              >
                <Lock className="h-4 w-4 shrink-0" />
                Iniciá sesión para ver el precio
              </div>
            )}
          </div>

          {full && enModoDescuento && full.producto.tramos_descuento.length > 0 && (
          <>
          <div style={{ height: 1, backgroundColor: theme.accentTint(0.2) }} />
          <div className="px-4 pt-3 pb-2">
            <SavingsBar
              precioVenta={full.producto.precio_venta as number}
              cantidad={cantidad}
              tramos={full.producto.tramos_descuento}
              redondeo={full.producto.redondeo}
              theme={theme}
              colorScale={getTramoScaleColorV2}
            />
          </div>
          <div style={{ height: 1, backgroundColor: theme.accentTint(0.2) }} />
          <table className="w-full text-base">
            <tbody>
              {(() => {
                const tramos = full.producto.tramos_descuento
                // Orden ascendente por cantidad_minima: el índice de cada tramo en esta
                // lista define su color (1º rojo, 2º naranja, 3º amarillo, último verde),
                // en vez de su % de descuento — así cada fila tiene un color distinto y
                // reconocible sin depender de qué porcentajes puntuales se hayan cargado.
                const ordenados = [...tramos].sort((a, b) => a.cantidad_minima - b.cantidad_minima)
                return ordenados.map((t, i) => {
                  const activo = cantidad >= t.cantidad_minima
                    && !tramos.some(o => o.cantidad_minima > t.cantidad_minima && o.cantidad_minima <= cantidad)
                  const colorTramo = getTramoScaleColorV2(ordenados.length > 1 ? i / (ordenados.length - 1) : 1)
                  return (
                    <tr key={t.cantidad_minima} style={activo ? { backgroundColor: theme.accent } : undefined}>
                      <td className="px-4 py-2 font-medium" style={{ color: activo ? theme.buttonBg : theme.textMuted }}>{t.cantidad_minima}+ u.</td>
                      <td className="py-2 font-bold" style={{ color: activo ? theme.buttonBg : colorTramo }}>−{t.descuento_porcentaje}%</td>
                      <td className="px-4 py-2 text-right font-bold" style={{ color: activo ? theme.buttonBg : theme.textPrimary }}>
                        ${calcularPrecioPorDescuento(full.producto.precio_venta as number, t.cantidad_minima, tramos, full.producto.redondeo).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
          </>
          )}

          <div style={{ height: 1, backgroundColor: theme.accentTint(0.2) }} />
          <div className="p-3 sm:p-4 space-y-3">
            {full ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-base font-medium" style={{ color: theme.textMuted }}>Cantidad</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCantidad(c => Math.max(1, c - 1))}
                      className="w-8 h-8 rounded-lg text-base font-medium"
                      style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
                    >−</button>
                    <input
                      type="number"
                      min={1}
                      value={cantidad}
                      onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-14 text-center rounded-lg text-base py-1 focus:outline-none"
                      style={{ backgroundColor: 'transparent', border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
                    />
                    <button
                      onClick={() => setCantidad(c => c + 1)}
                      className="w-8 h-8 rounded-lg text-base font-medium"
                      style={{ border: `1.5px solid ${theme.inputBorder}`, color: theme.textPrimary }}
                    >+</button>
                  </div>
                </div>

                {faltan > 0 ? (
                  <p
                    className="text-base font-medium text-center rounded-xl py-3"
                    style={{ color: '#E8C15A', backgroundColor: 'rgba(232,193,90,0.1)', border: '1.5px solid rgba(232,193,90,0.3)' }}
                  >
                    Te faltan {faltan} u. para el mínimo de {full.producto.cantidad_minima}
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
              </>
            ) : (
              <>
                <Link
                  href="/comercios"
                  className="w-full flex items-center justify-center rounded-xl font-semibold py-3 text-base transition-colors"
                  style={{ backgroundColor: theme.buttonBg, color: theme.buttonText, border: `1.5px solid ${theme.buttonBorder}` }}
                >
                  Iniciar sesión
                </Link>
                <Link
                  href="/comercios/solicitud"
                  className="w-full text-center text-sm hover:underline"
                  style={{ color: theme.textMuted }}
                >
                  ¿No tenés cuenta? Solicitá acceso
                </Link>
              </>
            )}
          </div>
          </Card3D>
          </div>
        </div>
      </div>
    </div>
  )
}
