'use client';

import Link from 'next/link';
import { formatPrice } from '@/lib/utils';
import type { Section } from '@/types';

interface SectionStripProps {
  section: Section;
}

export function SectionStrip({ section }: SectionStripProps) {
  if (section.products.length === 0) return null;

  const bgColor = section.bg_color || '#0D1B2A';
  const textColor = section.text_color || '#ffffff';

  const getMoreHref = () => {
    if (section.criteria_type === 'featured') return '/?featured=true';
    if (section.criteria_type === 'immediate_delivery') return '/?immediate_delivery=true';
    if (section.criteria_type === 'category' && section.criteria_value) return `/?category=${encodeURIComponent(section.criteria_value)}`;
    return '/';
  };

  return (
    <div className="mb-8">
      {/* Header */}
      <div
        className="rounded-2xl px-5 py-4 mb-4 flex items-center justify-between"
        style={{ backgroundColor: bgColor }}
      >
        <div>
          <h2 className="text-lg font-extrabold tracking-tight" style={{ color: textColor }}>
            {section.title}
          </h2>
          {section.subtitle && (
            <p className="text-sm opacity-75 mt-0.5" style={{ color: textColor }}>
              {section.subtitle}
            </p>
          )}
        </div>
        {section.criteria_type !== 'manual' && (
          <Link
            href={getMoreHref()}
            className="text-xs font-semibold opacity-80 hover:opacity-100 flex items-center gap-1 shrink-0 ml-4"
            style={{ color: textColor }}
          >
            Ver más →
          </Link>
        )}
      </div>

      {/* Products horizontal scroll */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4">
        <div className="flex gap-3" style={{ width: 'max-content' }}>
          {section.products.map((product) => {
            const primaryImage = product.images.find((img) => img.is_primary) || product.images[0];
            return (
              <Link
                key={product.id}
                href={`/producto/${product.slug}`}
                className="group block bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                style={{ width: '160px' }}
              >
                <div className="aspect-square relative overflow-hidden bg-zinc-50">
                  {primaryImage ? (
                    <img
                      src={primaryImage.url}
                      alt={primaryImage.alt_text || product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-zinc-800 line-clamp-2 leading-snug mb-1">
                    {product.name}
                  </p>
                  <p className="text-sm font-extrabold text-zinc-900 tabular-nums">
                    {formatPrice(product.price)}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
