'use client';

import { MessageCircle, CheckCircle2, AlertTriangle, Clock, Package } from 'lucide-react';
import { cn, getWhatsAppUrl } from '@/lib/utils';
import { trackPublicEvent } from '@/lib/analytics';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StockAvailabilityProps {
  /**
   * stockQty: unidades físicas disponibles.
   * Solo se pasa desde admin o contextos que tienen el dato real.
   * Si no se pasa, la lógica recae en isCheckStock e isImmediateDelivery.
   */
  stockQty?: number;
  isCheckStock: boolean;
  isImmediateDelivery: boolean;
  isOnDemand?: boolean;
  productName: string;
  productSlug?: string;
  productPrice?: number | null;
  whatsappNumber: string;
  /**
   * Umbral para "pocas unidades". Prioridad: producto > global > default (5).
   * Si stock_qty <= lowStockThreshold && > 0 → estado "low".
   */
  lowStockThreshold?: number;
  className?: string;
}

/**
 * high      → stock_qty > 5, o is_immediate_delivery, o (!is_check_stock y sin qty)
 * low       → stock_qty > 0 && <= 5
 * on_demand → is_on_demand=true y sin stock
 * none      → stock_qty === 0, o is_check_stock sin delivery inmediata
 */
export type StockLevel = 'high' | 'low' | 'on_demand' | 'none';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function resolveStockLevel(
  isCheckStock: boolean,
  isImmediateDelivery: boolean,
  stockQty?: number,
  lowStockThreshold = 5,
  isOnDemand = false,
): StockLevel {
  // Si tenemos el dato exacto de stock, lo usamos como fuente de verdad
  if (typeof stockQty === 'number') {
    if (stockQty <= 0) return isOnDemand ? 'on_demand' : 'none';
    if (stockQty <= lowStockThreshold) return 'low';
    return 'high';
  }

  // Sin dato de qty, derivamos de los flags del producto
  if (isImmediateDelivery) return 'high';
  if (isOnDemand) return 'on_demand';
  if (isCheckStock) return 'none';
  return 'high';
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(price);
}

function buildWhatsAppMessage(
  level: StockLevel,
  productName: string,
  productPrice?: number | null,
  productSlug?: string,
): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.hefaproductos.com.ar';
  const productUrl = productSlug ? `${siteUrl}/producto/${productSlug}` : undefined;

  const lines: string[] = [];

  if (level === 'high') {
    lines.push(`Hola! Quiero comprar el siguiente producto:`);
  } else if (level === 'low') {
    lines.push(`Hola! Vi que quedan pocas unidades y quiero reservar:`);
  } else if (level === 'on_demand') {
    lines.push(`Hola! Quiero hacer un pedido especial del siguiente producto:`);
  } else {
    lines.push(`Hola! Quiero consultar disponibilidad del producto:`);
  }

  lines.push(`📦 ${productName}`);

  if (productPrice) {
    lines.push(`💰 Precio: ${formatPrice(productPrice)}`);
  }

  if (productUrl) {
    lines.push(productUrl);
  }

  return lines.join('\n');
}

// ─── StockBar ─────────────────────────────────────────────────────────────────

/**
 * Three-segment visual bar. Each segment is wider than the next,
 * creating a bar-like shape that reads instantly as a level indicator.
 * Reversed render order: widest segment = leftmost (first filled).
 */
function StockBar({ level }: { level: StockLevel }) {
  // [wide, medium, narrow] — filled left-to-right based on level
  const fills: Record<StockLevel, [boolean, boolean, boolean]> = {
    high: [true, true, true],
    low: [true, true, false],
    on_demand: [true, false, false],
    none: [false, false, false],
  };

  const colors: Record<StockLevel, string> = {
    high: 'bg-emerald-500',
    low: 'bg-amber-500',
    on_demand: 'bg-violet-500',
    none: 'bg-zinc-300',
  };

  const [f0, f1, f2] = fills[level];
  const color = colors[level];
  const empty = 'bg-zinc-200';

  return (
    <div className="flex items-center gap-1" aria-hidden="true">
      <div className={cn('h-2 w-8 rounded-full transition-colors duration-500', f0 ? color : empty)} />
      <div className={cn('h-2 w-5 rounded-full transition-colors duration-500', f1 ? color : empty)} />
      <div className={cn('h-2 w-3 rounded-full transition-colors duration-500', f2 ? color : empty)} />
    </div>
  );
}

// ─── WhatsAppCTA ──────────────────────────────────────────────────────────────

interface WhatsAppCTAProps {
  level: StockLevel;
  href: string;
  productName: string;
  productSlug?: string;
  productPrice?: number | null;
}

function WhatsAppCTA({ level, href, productName, productSlug, productPrice }: WhatsAppCTAProps) {
  const labels: Record<StockLevel, { primary: string; sub: string }> = {
    high: {
      primary: 'Comprar por WhatsApp',
      sub: 'Respuesta inmediata · Stock confirmado',
    },
    low: {
      primary: 'Reservar ahora por WhatsApp',
      sub: 'Últimas unidades — asegurá la tuya',
    },
    on_demand: {
      primary: 'Pedir por encargo',
      sub: 'Lo conseguimos para vos · Consultanos',
    },
    none: {
      primary: 'Consultar disponibilidad',
      sub: 'Te avisamos cuando ingresa stock',
    },
  };

  const { primary, sub } = labels[level];

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackPublicEvent('whatsapp_click', {
          product_slug: productSlug,
          metadata: {
            origin: 'stock_availability_cta',
            stock_level: level,
            product_name: productName,
            product_price: productPrice ?? null,
          },
        });
      }}
      className={cn(
        'group relative flex w-full flex-col items-center justify-center gap-0.5 overflow-hidden',
        'rounded-xl px-5 py-3.5 text-white transition-all duration-200',
        'active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        level === 'none'
          ? 'bg-zinc-700 hover:bg-zinc-800 focus-visible:ring-zinc-600'
          : level === 'on_demand'
            ? 'bg-violet-600 hover:bg-violet-700 focus-visible:ring-violet-500'
            : 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500',
      )}
      aria-label={`${primary} - ${productName}`}
    >
      {/* Shimmer sweep on hover — respects prefers-reduced-motion */}
      <span
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent motion-safe:group-hover:translate-x-full motion-safe:transition-transform motion-safe:duration-700"
        aria-hidden="true"
      />

      <span className="relative flex items-center gap-2 font-semibold text-base leading-tight">
        <MessageCircle className="h-5 w-5 shrink-0" aria-hidden="true" />
        {primary}
      </span>
      <span className="relative text-[11px] font-medium opacity-80 tracking-wide">{sub}</span>
    </a>
  );
}

// ─── Signal Strip config ──────────────────────────────────────────────────────

const stripConfig: Record<
  StockLevel,
  {
    container: string;
    labelColor: string;
    subColor: string;
    label: string;
    sublabel: string;
    showPing: boolean;
  }
> = {
  high: {
    container: 'bg-emerald-50 border-emerald-200',
    labelColor: 'text-emerald-800',
    subColor: 'text-emerald-600',
    label: 'Stock disponible',
    sublabel: 'Listo para despachar',
    showPing: false,
  },
  low: {
    container: 'bg-amber-50 border-amber-200',
    labelColor: 'text-amber-800',
    subColor: 'text-amber-600',
    label: 'Pocas unidades',
    sublabel: 'Alta demanda — puede agotarse',
    showPing: true,
  },
  on_demand: {
    container: 'bg-violet-50 border-violet-200',
    labelColor: 'text-violet-800',
    subColor: 'text-violet-600',
    label: 'Por pedido',
    sublabel: 'Lo conseguimos para vos',
    showPing: false,
  },
  none: {
    container: 'bg-zinc-100 border-zinc-200',
    labelColor: 'text-zinc-600',
    subColor: 'text-zinc-500',
    label: 'Sin stock momentáneo',
    sublabel: 'Consultá para próximo ingreso',
    showPing: false,
  },
};

const stripIcon: Record<StockLevel, React.ReactNode> = {
  high: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />,
  low: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />,
  on_demand: <Package className="h-5 w-5 text-violet-600 shrink-0" aria-hidden="true" />,
  none: <Clock className="h-5 w-5 text-zinc-500 shrink-0" aria-hidden="true" />,
};

// ─── Main component ───────────────────────────────────────────────────────────

export function StockAvailability({
  stockQty,
  isCheckStock,
  isImmediateDelivery,
  isOnDemand = false,
  productName,
  productSlug,
  productPrice,
  whatsappNumber,
  lowStockThreshold = 5,
  className,
}: StockAvailabilityProps) {
  const level = resolveStockLevel(isCheckStock, isImmediateDelivery, stockQty, lowStockThreshold, isOnDemand);
  const { container, labelColor, subColor, label, sublabel, showPing } = stripConfig[level];

  const message = buildWhatsAppMessage(level, productName, productPrice, productSlug);
  const whatsappUrl = getWhatsAppUrl(whatsappNumber, message);

  return (
    <div className={cn('flex flex-col gap-3', className)}>

      {/* ── Signal Strip ──────────────────────────────────────────────── */}
      <div
        className={cn('rounded-xl border px-4 py-3.5 flex items-center justify-between gap-3', container)}
        role="status"
        aria-live="polite"
        aria-label={`Disponibilidad: ${label}. ${sublabel}`}
      >
        {/* Left: icon + text */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Icon — ping ring only for low-stock urgency */}
          <span className="relative shrink-0">
            {showPing && (
              <span
                className="absolute inset-0 rounded-full bg-amber-400/30 scale-150 animate-ping motion-reduce:animate-none"
                aria-hidden="true"
              />
            )}
            {stripIcon[level]}
          </span>

          <div className="min-w-0">
            <p className={cn('font-bold text-sm leading-tight', labelColor)}>{label}</p>
            <p className={cn('text-[11px] leading-tight mt-0.5 truncate', subColor)}>{sublabel}</p>
          </div>
        </div>

        {/* Right: visual stock bar */}
        <StockBar level={level} />
      </div>

      {/* ── WhatsApp CTA ─────────────────────────────────────────────── */}
      <WhatsAppCTA
        level={level}
        href={whatsappUrl}
        productName={productName}
        productSlug={productSlug}
        productPrice={productPrice}
      />
    </div>
  );
}
