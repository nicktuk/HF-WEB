'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Zap } from 'lucide-react';
import { ContactButton } from '@/components/public/ContactButton';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/utils';
import { usePublicProduct } from '@/hooks/useProducts';
import type { ProductImage } from '@/types';

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { data: product, isLoading, error } = usePublicProduct(slug);
  const [selectedImage, setSelectedImage] = useState<ProductImage | null>(null);

  // Update selected image when product loads
  useEffect(() => {
    if (product?.images?.length) {
      const primary = product.images.find((img) => img.is_primary) || product.images[0];
      setSelectedImage(primary);
    }
  }, [product]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft className="h-5 w-5" />
            Volver al catálogo
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-6">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="aspect-square relative rounded-lg overflow-hidden bg-white border">
              {selectedImage ? (
                <Image
                  src={selectedImage.url}
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
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.images.map((image, index) => (
                  <button
                    key={image.id}
                    onClick={() => setSelectedImage(image)}
                    className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
                      selectedImage?.id === image.id ? 'border-primary-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Image
                      src={image.url}
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

            {product.is_immediate_delivery && (
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 mb-3">
                <Zap className="h-3.5 w-3.5" />
                Entrega inmediata
              </div>
            )}

            {product.is_check_stock && (
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 mb-3">
                Consultar stock
              </div>
            )}

            {/* Name */}
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
              {product.name}
            </h1>

            {/* Price */}
            <div className="mb-6">
              <p className="text-4xl font-bold text-primary-600">
                {formatPrice(product.price)}
              </p>
            </div>

            {/* Description */}
            {product.short_description && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Descripción
                </h2>
                <p className="text-gray-600">{product.short_description}</p>
              </div>
            )}

            {/* Contact Buttons */}
            <div className="hidden md:flex flex-col gap-3">
              <ContactButton
                productName={product.name}
                productSlug={slug}
                variant="whatsapp"
                size="lg"
              />
              <ContactButton
                productName={product.name}
                productSlug={slug}
                variant="email"
                size="lg"
              />
            </div>
          </div>
        </div>
      </main>

      {/* Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t md:hidden">
        <ContactButton
          productName={product.name}
          productSlug={slug}
          variant="whatsapp"
          size="lg"
          className="w-full"
        />
      </div>
    </div>
  );
}
