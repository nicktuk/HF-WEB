'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StockAvailability } from '@/components/public/StockAvailability';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/utils';
import { usePublicProduct } from '@/hooks/useProducts';
import { trackPublicEvent } from '@/lib/analytics';
import type { ProductImage, ProductPublic } from '@/types';
import { SectionStrip } from '@/components/public/SectionStrip';
import { ProductRatingSummary, ProductReviews } from '@/components/public/ProductReviews';
import { PublicHeader } from '@/components/public/PublicHeader';
import { useQuery } from '@tanstack/react-query';
import { publicApi, resolveImageUrl, fetchPublicCatalogSettings } from '@/lib/api';
import { useBadgeLabels } from '@/hooks/useBadgeLabels';
import { useCart } from '@/context/CartContext';
import { ShoppingCart } from 'lucide-react';

export default function ProductPageClient({ initialData }: { initialData?: ProductPublic }) {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { data: product, isLoading, error } = usePublicProduct(slug, initialData);
  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);

  const { data: sections } = useQuery({
    queryKey: ['public-sections'],
    queryFn: () => publicApi.getSections(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: catalogSettings } = useQuery({
    queryKey: ['public-catalog-settings'],
    queryFn: fetchPublicCatalogSettings,
    staleTime: 5 * 60 * 1000,
  });

  const { data: badgeLabels } = useBadgeLabels();
  const { addItem } = useCart();

  // Threshold: producto primero, luego global, luego default
  const lowStockThreshold = product?.stock_low_threshold ?? catalogSettings?.stock_low_threshold ?? 5;

  // Color selection — explicit state, decoupled from image gallery
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Non-primary colored images only
  const allColoredImages = (product?.images ?? []).filter(img => img.color && !img.is_primary);
  const colorStockMap = Object.fromEntries((product?.color_stock ?? []).map(s => [s.color, s.quantity]));
  const hasColorStock = (product?.color_stock ?? []).length > 0;
  const hideOutOfStockColors = (catalogSettings?.hide_out_of_stock_colors ?? false) && hasColorStock;
  const coloredImages = hideOutOfStockColors
    ? allColoredImages.filter(img => (colorStockMap[img.color!] ?? 0) > 0)
    : allColoredImages;
  const uniqueColors = Array.from(new Set(coloredImages.map(img => img.color!)));
  const colorNameMap = Object.fromEntries(
    coloredImages.filter(img => img.alt_text).map(img => [img.color!, img.alt_text!])
  );
  const effectiveStockQty = hasColorStock && selectedColor && colorStockMap[selectedColor] !== undefined
    ? colorStockMap[selectedColor]
    : product?.stock_qty ?? undefined;

  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    // Sync gallery to first image with that color
    const match = coloredImages.find(img => img.color === color);
    if (match) setSelectedImage(match);
  };

  const sortedImages = hideOutOfStockColors
    ? (product?.images ?? []).filter(img => !img.color || (colorStockMap[img.color] ?? 0) > 0)
    : (product?.images ?? []);
  const currentIndex = selectedImage ? sortedImages.findIndex((img) => img.id === selectedImage.id) : 0;

  const goToPrev = () => {
    if (sortedImages.length < 2) return;
    const prev = (currentIndex - 1 + sortedImages.length) % sortedImages.length;
    setSelectedImage(sortedImages[prev]);
  };

  const goToNext = () => {
    if (sortedImages.length < 2) return;
    const next = (currentIndex + 1) % sortedImages.length;
    setSelectedImage(sortedImages[next]);
  };

  const swipeStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (swipeStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - swipeStartX.current;
    if (Math.abs(delta) > 40) delta < 0 ? goToNext() : goToPrev();
    swipeStartX.current = null;
  };

  // Update selected image when product loads
  useEffect(() => {
    if (product?.images?.length) {
      const primary = product.images.find((img) => img.is_primary) || product.images[0];
      setSelectedImage(primary);
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;
    trackPublicEvent('page_view', {
      category: product.category || undefined,
      subcategory: product.subcategory || undefined,
      product_id: product.id,
      product_slug: product.slug,
      metadata: { screen: 'product_detail' },
    });
  }, [product]);

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: '#e0f2fe' }}>
        <PublicHeader />
        <div className="container mx-auto px-4 py-6">
          <Skeleton className="h-6 w-32 mb-6" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="aspect-square w-full rounded-lg" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-12 w-32" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-12 w-48" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#e0f2fe' }}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Producto no encontrado
          </h1>
          <p className="text-gray-600 mb-4">
            El producto que buscas no existe o no está disponible.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Volver al catálogo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e0f2fe' }}>
      <PublicHeader />

      {/* Content */}
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-6">

        {/* Título + precio — ancho completo */}
        <div className="mb-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            {product.category && <span>{product.category}</span>}
            {product.category && product.brand && <span>•</span>}
            {product.brand && <span>{product.brand}</span>}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">
            {product.name}
          </h1>
          <div className="flex items-baseline gap-2">
            <p className="text-4xl font-bold text-primary-600">
              {formatPrice(product.price)}
            </p>
            {product.installments_3 && (
              <span className="text-sm font-medium text-gray-400">efectivo / transferencia</span>
            )}
          </div>
          {product.installments_3 && product.installment_price && (
            <p className="mt-1 text-2xl font-bold text-teal-700">
              3 de {formatPrice(product.installment_price)}{' '}
              <span className="text-base font-semibold text-teal-600">con tarjeta</span>
            </p>
          )}
          <p className="mt-2 text-sm text-gray-500">
            Los precios pueden variar mínimamente según stock y/o disponibilidad de los proveedores.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Columna 1: Imagen + fotos */}
          <div className="space-y-4">
          <div className="lg:flex lg:gap-3">
            <div
              className="lg:order-2 lg:flex-1 lg:min-w-0 aspect-square relative rounded-lg overflow-hidden bg-white border group"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {selectedImage ? (
                <Image
                  src={resolveImageUrl(selectedImage.url) ?? selectedImage.url}
                  alt={selectedImage.alt_text || product.name}
                  fill
                  className="object-contain"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                  <svg className="w-24 h-24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Delivery badge — corner ribbon */}
              {(product.is_immediate_delivery || ((product.stock_qty || 0) <= 0 && product.is_on_demand)) && (
                <div className="absolute top-0 left-0 z-10 pointer-events-none overflow-hidden w-32 h-32">
                  <div
                    className={`absolute -top-1 -left-10 w-36 py-1.5 text-center text-[10px] font-bold text-white uppercase tracking-widest shadow-md rotate-[-45deg] origin-center ${
                      product.is_immediate_delivery && (product.stock_qty || 0) > 0 ? 'bg-emerald-600' : 'bg-violet-600'
                    }`}
                    style={{ top: '28px', left: '-36px' }}
                  >
                    {product.is_immediate_delivery && (product.stock_qty || 0) > 0
                      ? `⚡ ${badgeLabels?.badge_text_immediate_delivery ?? 'Inmediata'}`
                      : `📦 ${badgeLabels?.badge_text_on_demand ?? 'Por pedido'}`}
                  </div>
                </div>
              )}

              {/* Navigation arrows */}
              {sortedImages.length > 1 && (
                <>
                  <button
                    onClick={goToPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm border border-gray-200 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-white"
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-700" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm border border-gray-200 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-white"
                    aria-label="Imagen siguiente"
                  >
                    <ChevronRight className="h-5 w-5 text-gray-700" />
                  </button>
                  {/* Dot indicators */}
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
                    {sortedImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(sortedImages[i])}
                        className={`h-1.5 rounded-full transition-all ${
                          i === currentIndex ? 'w-4 bg-primary-600' : 'w-1.5 bg-gray-400/70 hover:bg-gray-600'
                        }`}
                        aria-label={`Ir a imagen ${i + 1}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails — all products */}
            {sortedImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 lg:order-1 lg:flex-col lg:items-center lg:w-20 lg:shrink-0 lg:overflow-x-visible lg:overflow-y-auto lg:max-h-[500px] lg:pb-0">
                {sortedImages.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(image)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage?.id === image.id ? 'border-primary-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Image
                      src={resolveImageUrl(image.url) ?? image.url}
                      alt={image.alt_text || `${product.name} - ${index + 1}`}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

            {/* Video */}
            {product.video_url && (
              <div className="rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  src={resolveImageUrl(product.video_url) ?? product.video_url}
                  controls
                  className="w-full h-full object-contain"
                  preload="metadata"
                />
              </div>
            )}
          </div>

          {/* Columna 2: Descripción */}
          <div>
            {/* On-demand notice */}
            {product.is_on_demand && !product.is_immediate_delivery && catalogSettings?.on_demand_description && (
              <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3.5 flex items-start gap-3">
                <span className="text-lg shrink-0 leading-tight">📦</span>
                <p className="text-sm text-violet-800 leading-relaxed">{catalogSettings.on_demand_description}</p>
              </div>
            )}

            {/* Description */}
            {product.short_description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Descripción
                </h2>
                <p className="text-gray-600 whitespace-pre-line">{product.short_description}</p>
              </div>
            )}
          </div>

          {/* Columna 3: Calificación, vendidos, colores y botones */}
          <div>
            <ProductRatingSummary
              ratingAvg={product.rating_avg}
              ratingCount={product.rating_count}
              unitsSold={product.units_sold}
            />

            {/* Color selector — explicit, in buy box */}
            {uniqueColors.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-700 mb-2.5">
                  Color
                  {selectedColor && colorNameMap[selectedColor] && (
                    <span className="font-normal text-gray-500 ml-1.5">— {colorNameMap[selectedColor]}</span>
                  )}
                </p>
                <div className="flex gap-3 flex-wrap">
                  {uniqueColors.map(color => {
                    const qty = colorStockMap[color];
                    const outOfStock = hasColorStock && qty === 0;
                    const isActive = selectedColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => !outOfStock && handleSelectColor(color)}
                        disabled={outOfStock}
                        title={outOfStock ? 'Sin stock' : (colorNameMap[color] ?? color)}
                        className={`w-9 h-9 rounded-full border-2 transition-all relative ${
                          outOfStock
                            ? 'opacity-30 cursor-not-allowed'
                            : 'hover:scale-110 cursor-pointer'
                        } ${
                          isActive
                            ? 'border-gray-800 scale-110 shadow-md ring-2 ring-offset-1'
                            : 'border-white shadow-sm ring-1 ring-gray-200'
                        }`}
                        style={{ backgroundColor: color }}
                      >
                        {outOfStock && (
                          <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm">✕</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {hasColorStock && selectedColor && (colorStockMap[selectedColor] ?? 0) > 0 && (colorStockMap[selectedColor] ?? 0) <= 3 && (
                  <p className="text-xs text-amber-600 font-semibold mt-2">
                    ¡Últimas {colorStockMap[selectedColor]} unidad{colorStockMap[selectedColor] === 1 ? '' : 'es'}!
                  </p>
                )}
                {uniqueColors.length > 0 && !selectedColor && (
                  <p className="text-xs text-gray-400 mt-1.5">Seleccioná un color para agregar al carrito</p>
                )}
              </div>
            )}

            {/* Stock Availability + WhatsApp CTA — desktop */}
            <div className="hidden md:block space-y-3">
              {(effectiveStockQty ?? 0) > 0 && (uniqueColors.length === 0 || selectedColor) && (
                <button
                  onClick={() => addItem(product, selectedColor, selectedColor ? (colorNameMap[selectedColor] ?? null) : null)}
                  className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold py-3 transition-colors"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span className="flex items-center gap-2">
                    Agregar al carrito
                    {selectedColor && (
                      <span
                        className="w-4 h-4 rounded-full border border-white shadow-sm ring-1 ring-primary-300 inline-block"
                        style={{ backgroundColor: selectedColor }}
                      />
                    )}
                  </span>
                </button>
              )}
              <StockAvailability
                isCheckStock={product.is_check_stock}
                isImmediateDelivery={product.is_immediate_delivery}
                isOnDemand={product.is_on_demand}
                stockQty={effectiveStockQty}
                productName={product.name}
                productSlug={slug}
                productPrice={product.price}
                whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''}
                lowStockThreshold={lowStockThreshold}
                showCTA={(effectiveStockQty ?? 0) <= 0}
              />
            </div>
          </div>
        </div>

        {/* Comentarios — ancho completo, debajo de las 3 columnas */}
        <div className="max-w-3xl mt-10">
          <ProductReviews reviews={product.reviews} />
        </div>

      {/* Sections */}
      {sections && sections.length > 0 && (
        <div className="mt-10 container mx-auto px-4 space-y-4 pb-24 md:pb-10">
          {sections.map((section) => (
            <SectionStrip key={section.id} section={section} />
          ))}
        </div>
      )}
      </main>

      {/* Mobile CTA — fixed bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t shadow-lg md:hidden space-y-2">
        {(product.stock_qty ?? 0) > 0 && (uniqueColors.length === 0 || selectedColor) && (
          <button
            onClick={() => addItem(product, selectedColor, selectedColor ? (colorNameMap[selectedColor] ?? null) : null)}
            className="flex items-center justify-center gap-2 w-full rounded-xl border-2 border-primary-300 bg-primary-50 hover:bg-primary-100 text-primary-700 font-semibold py-2.5 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="flex items-center gap-2">
              Agregar al carrito
              {selectedColor && (
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white shadow-sm ring-1 ring-primary-300 inline-block"
                  style={{ backgroundColor: selectedColor }}
                />
              )}
            </span>
          </button>
        )}
        <StockAvailability
          isCheckStock={product.is_check_stock}
          isImmediateDelivery={product.is_immediate_delivery}
          stockQty={product.stock_qty ?? undefined}
          productName={product.name}
          productSlug={slug}
          productPrice={product.price}
          whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''}
          lowStockThreshold={lowStockThreshold}
          showCTA={(product.stock_qty ?? 0) <= 0}
        />
      </div>
    </div>
  );
}
