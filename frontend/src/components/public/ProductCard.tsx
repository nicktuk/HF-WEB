'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, X } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { trackPublicEvent } from '@/lib/analytics';
import { resolveImageUrl } from '@/lib/api';
import { useBadgeLabels } from '@/hooks/useBadgeLabels';
import { useCart } from '@/context/CartContext';
import type { ProductPublic } from '@/types';

interface ProductCardProps {
  product: ProductPublic;
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.images.find((img) => img.is_primary) || product.images[0];
  const { data: labels } = useBadgeLabels();
  const { addItem } = useCart();
  const [pickingColor, setPickingColor] = useState(false);

  const t = {
    immediate: labels?.badge_text_immediate_delivery ?? 'Inmediata',
    featured: labels?.badge_text_featured ?? 'Nuevo',
    onDemand: labels?.badge_text_on_demand ?? 'Por pedido',
    checkStock: labels?.badge_text_check_stock ?? 'Consultar',
    installments: labels?.badge_text_installments ?? 'Cuotas',
  };

  // Non-primary colored images only (image 0 never has color)
  const coloredImages = product.images.filter(img => img.color && !img.is_primary);
  const uniqueColors = Array.from(new Set(coloredImages.map(img => img.color!)));
  const colorNameMap = Object.fromEntries(
    coloredImages.filter(img => img.alt_text).map(img => [img.color!, img.alt_text!])
  );
  const stockMap = Object.fromEntries((product.color_stock ?? []).map(s => [s.color, s.quantity]));
  const hasColorStock = (product.color_stock ?? []).length > 0;
  const hasColors = uniqueColors.length > 0;

  function handleAddDirect(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    addItem(product);
  }

  function handleStartPick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setPickingColor(true);
  }

  function handlePickColor(e: React.MouseEvent, color: string) {
    e.stopPropagation();
    e.preventDefault();
    addItem(product, color, colorNameMap[color] ?? null);
    setPickingColor(false);
  }

  function handleCancelPick(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setPickingColor(false);
  }

  return (
    <Link
      href={`/producto/${product.slug}`}
      onClick={(e) => {
        if (pickingColor) {
          e.preventDefault();
          setPickingColor(false);
          return;
        }
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
              className="object-contain group-hover:scale-[1.07] transition-transform duration-500 ease-out"
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
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

        {/* Status badges — desktop overlay only */}
        {(product.is_featured || product.is_immediate_delivery || product.is_on_demand || product.is_check_stock || product.installments_3) && (
          <div className="absolute top-2.5 left-2.5 hidden sm:flex flex-col gap-1.5">
            {product.is_featured && (product.stock_qty || 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {t.featured}
              </span>
            )}
            {product.is_immediate_delivery && (product.stock_qty || 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t.immediate}
              </span>
            )}
            {(product.stock_qty || 0) <= 0 && (product.is_on_demand || product.is_immediate_delivery) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                {t.onDemand}
              </span>
            )}
            {product.is_check_stock && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                {t.checkStock}
              </span>
            )}
            {product.installments_3 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {t.installments}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3.5 flex flex-col gap-1.5">
        {/* Status badges — mobile only (below image) */}
        {(product.is_featured || product.is_immediate_delivery || product.is_on_demand || product.is_check_stock || product.installments_3) && (
          <div className="flex flex-wrap gap-1 sm:hidden">
            {product.is_featured && (product.stock_qty || 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                {t.featured}
              </span>
            )}
            {product.is_immediate_delivery && (product.stock_qty || 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {t.immediate}
              </span>
            )}
            {(product.stock_qty || 0) <= 0 && (product.is_on_demand || product.is_immediate_delivery) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                {t.onDemand}
              </span>
            )}
            {product.is_check_stock && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                {t.checkStock}
              </span>
            )}
            {product.installments_3 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                {t.installments}
              </span>
            )}
          </div>
        )}

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

        {/* Color swatches (decorative) */}
        {hasColors && !pickingColor && (() => {
          return (
            <div className="flex gap-1.5 flex-wrap">
              {uniqueColors.map(color => {
                const outOfStock = hasColorStock && stockMap[color] === 0;
                return (
                  <span
                    key={color}
                    className={`w-4 h-4 rounded-full border border-white shadow-sm ring-1 ring-zinc-200 transition-opacity ${outOfStock ? 'opacity-25' : 'opacity-100'}`}
                    style={{ backgroundColor: color }}
                    title={outOfStock ? 'Sin stock' : undefined}
                  />
                );
              })}
            </div>
          );
        })()}

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
          {!pickingColor && (
            <span className="text-xs font-semibold text-primary-600 flex items-center gap-0.5 group-hover:gap-1.5 transition-all duration-200 mt-1">
              Ver
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          )}
        </div>

        {/* Cart action — only when stock available */}
        {(product.stock_qty ?? 0) > 0 && (
        <div onClick={e => e.stopPropagation()}>
          {pickingColor ? (
            <div className="pt-2 border-t border-zinc-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wide">Elegí un color</span>
                <button
                  onClick={handleCancelPick}
                  className="flex items-center justify-center w-5 h-5 rounded-full hover:bg-zinc-100 transition-colors text-zinc-400"
                  aria-label="Cancelar"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {uniqueColors.map(color => {
                  const outOfStock = hasColorStock && stockMap[color] === 0;
                  return (
                    <button
                      key={color}
                      onClick={(e) => !outOfStock && handlePickColor(e, color)}
                      disabled={outOfStock}
                      title={outOfStock ? 'Sin stock' : color}
                      className={`w-7 h-7 rounded-full border-2 border-white shadow-sm ring-1 ring-zinc-200 transition-all ${
                        outOfStock
                          ? 'opacity-25 cursor-not-allowed'
                          : 'hover:scale-110 hover:ring-zinc-400 cursor-pointer'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  );
                })}
              </div>
            </div>
          ) : (
            <button
              onClick={hasColors ? handleStartPick : handleAddDirect}
              className="mt-1 w-full flex items-center justify-center gap-1.5 rounded-xl border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold py-2 transition-colors"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              Agregar al carrito
            </button>
          )}
        </div>
        )}
      </div>
    </Link>
  );
}
