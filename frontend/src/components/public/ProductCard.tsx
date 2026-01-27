'use client';

import Image from 'next/image';
import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import type { ProductPublic } from '@/types';

interface ProductCardProps {
  product: ProductPublic;
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.images.find((img) => img.is_primary) || product.images[0];

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="group block bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative"
    >
      {/* Nuevo Badge - Corner ribbon */}
      {product.is_featured && (
        <div className="absolute top-0 right-0 z-10">
          <div className="bg-amber-500 text-white text-xs font-bold px-3 py-1 transform rotate-0 origin-top-right shadow-md"
               style={{
                 clipPath: 'polygon(0 0, 100% 0, 100% 100%, 10% 100%)',
               }}>
            Nuevo
          </div>
        </div>
      )}

      {/* Entrega inmediata badge */}
      {product.is_immediate_delivery && (
        <div className="absolute top-0 left-0 z-10">
          <div className="bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 shadow-md"
               style={{
                 clipPath: 'polygon(0 0, 100% 0, 90% 100%, 0 100%)',
               }}>
            Entrega inmediata
          </div>
        </div>
      )}

      {/* Image */}
      <div className="aspect-[4/3] relative overflow-hidden bg-gray-100">
        {primaryImage ? (
          <Image
            src={primaryImage.url}
            alt={primaryImage.alt_text || product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            <svg className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category */}
        {product.category && (
          <p className="text-xs text-gray-500 mb-1">{product.category}</p>
        )}

        {/* Name */}
        <h3 className="font-medium text-gray-900 line-clamp-2 mb-2 group-hover:text-primary-600 transition-colors">
          {product.name}
        </h3>

        {/* Brand */}
        {product.brand && (
          <p className="text-sm text-gray-500 mb-2">{product.brand}</p>
        )}

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold text-gray-900">
            {formatPrice(product.price)}
          </span>
          <span className="text-sm text-primary-600 group-hover:underline">
            Ver detalles →
          </span>
        </div>
      </div>
    </Link>
  );
}
