'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StockAvailability } from '@/components/public/StockAvailability';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/utils';
import { usePublicProduct } from '@/hooks/useProducts';
import { trackPublicEvent } from '@/lib/analytics';
import type { ProductImage } from '@/types';
import { SectionStrip } from '@/components/public/SectionStrip';
import { PublicHeader } from '@/components/public/PublicHeader';
import { useQuery } from '@tanstack/react-query';
import { publicApi, resolveImageUrl, fetchPublicCatalogSettings } from '@/lib/api';

export default function ProductPageClient() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { data: product, isLoading, error } = usePublicProduct(slug);
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

  // Threshold: producto primero, luego global, luego default
  const lowStockThreshold = product?.stock_low_threshold ?? catalogSettings?.stock_low_threshold ?? 5;

  const sortedImages = product?.images ?? [];
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
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square relative rounded-lg overflow-hidden bg-white border group">
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

              {/* Navigation arrows */}
              {sortedImages.length > 1 && (
                <>
                  <button
                    onClick={goToPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
                    aria-label="Imagen anterior"
                  >
                    <ChevronLeft className="h-5 w-5 text-gray-700" />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-md backdrop-blur-sm border border-gray-200 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white"
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

            {/* Thumbnails */}
            {sortedImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {sortedImages.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(image)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage?.id === image.id ? 'border-primary-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Image
                      src={resolveImageUrl(image.url) ?? image.url}
                      alt={image.alt_text || `${product.name} - ${index + 1}`}
                      width={80}
                      height={80}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Info */}
          <div>
            {/* Category & Brand */}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              {product.category && <span>{product.category}</span>}
              {product.category && product.brand && <span>•</span>}
              {product.brand && <span>{product.brand}</span>}
            </div>

            {/* Name */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              {product.name}
            </h1>

            {/* Price */}
            <div className="mb-6">
              <p className="text-4xl font-bold text-primary-600">
                {formatPrice(product.price)}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Los precios pueden variar mínimamente según stock y/o disponibilidad de los proveedores.
              </p>
            </div>

            {/* Description */}
            {product.short_description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Descripción
                </h2>
                <p className="text-gray-600 whitespace-pre-line">{product.short_description}</p>
              </div>
            )}

            {/* Stock Availability + WhatsApp CTA — desktop */}
            <div className="hidden md:block">
              <StockAvailability
                isCheckStock={product.is_check_stock}
                isImmediateDelivery={product.is_immediate_delivery}
                stockQty={product.stock_qty ?? undefined}
                productName={product.name}
                productSlug={slug}
                productPrice={product.price}
                whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''}
                lowStockThreshold={lowStockThreshold}
              />
            </div>
          </div>
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
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white border-t shadow-lg md:hidden">
        <StockAvailability
          isCheckStock={product.is_check_stock}
          isImmediateDelivery={product.is_immediate_delivery}
          stockQty={product.stock_qty ?? undefined}
          productName={product.name}
          productSlug={slug}
          productPrice={product.price}
          whatsappNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''}
          lowStockThreshold={lowStockThreshold}
        />
      </div>
    </div>
  );
}
