'use client';

import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import { trackPublicEvent } from '@/lib/analytics';
import { resolveImageUrl } from '@/lib/api';
import type { ProductPublic } from '@/types';

interface ProductCardProps {
  product: ProductPublic;
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.images.find((img) => img.is_primary) || product.images[0];

  return (
    <Link
      href={`/producto/${product.slug}`}
      onClick={() => {
        trackPublicEvent('product_click', {
          product_id: product.id,
          product_slug: product.slug,
          category: product.category || undefined,
          subcategory: product.subcategory || undefined,
        });
      }}
      className="group block bg-white rounded-2xl border border-zinc-200/80 shadow-sm card-lift overflow-hidden relative"
    >
      {/* Image */}
      <div className="aspect-square relative overflow-hidden bg-zinc-50">
        {primaryImage ? (
          <>
            <Image
              src={resolveImageUrl(primaryImage.url) ?? primaryImage.url}
              alt={primaryImage.alt_text || product.name}
              fill
              className="object-cover group-hover:scale-[1.07] transition-transform duration-500 ease-out"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
            {/* Gradient overlay that fades in on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-300 gap-2">
            <svg className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-[11px] font-medium uppercase tracking-widest text-zinc-400">Sin imagen</span>
          </div>
        )}

        {/* Status badges overlaid on image */}
        {(product.is_featured || product.is_immediate_delivery || product.is_check_stock || product.installments_3) && (
          <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
            {product.is_featured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Nuevo
              </span>
            )}
            {product.is_immediate_delivery && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Inmediata
              </span>
            )}
            {product.is_check_stock && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                Consultar
              </span>
            )}
            {product.installments_3 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Cuotas
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col gap-1.5">
        {/* Category + brand row */}
        <div className="flex items-center justify-between gap-2 min-h-[18px]">
          {product.category && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 truncate">
              {product.category}
            </p>
          )}
          {product.brand && (
            <p className="text-[11px] text-zinc-400 truncate text-right shrink-0">{product.brand}</p>
          )}
        </div>

        {/* Name */}
        <h3 className="font-semibold text-zinc-900 line-clamp-2 text-sm leading-snug group-hover:text-primary-700 transition-colors duration-200">
          {product.name}
        </h3>

        {/* Price row */}
        <div className="flex items-start justify-between mt-1 pt-2 border-t border-zinc-100">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-extrabold text-zinc-900 tabular-nums tracking-tight">
                {formatPrice(product.price)}
              </span>
              {product.installments_3 && (
                <span className="text-[10px] font-medium text-zinc-400 leading-none">efectivo / transf.</span>
              )}
            </div>
            {product.installments_3 && product.installment_price && (
              <p className="text-[11px] font-semibold text-teal-600 mt-0.5 tabular-nums">
                3 de {formatPrice(product.installment_price)} con tarjeta
              </p>
            )}
          </div>
          <span className="text-xs font-semibold text-primary-600 flex items-center gap-0.5 group-hover:gap-1.5 transition-all duration-200 mt-1">
            Ver
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </Link>
  );
}
