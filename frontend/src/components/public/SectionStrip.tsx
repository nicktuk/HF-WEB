'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { Section } from '@/types';

interface SectionStripProps {
  section: Section;
}

export function SectionStrip({ section }: SectionStripProps) {
  const [expanded, setExpanded] = useState(false);
  const bgColor = section.bg_color || '#0D1B2A';
  const textColor = section.text_color || '#ffffff';

  const filterHref = (() => {
    if (section.criteria_type === 'featured') return '/?featured=true';
    if (section.criteria_type === 'immediate_delivery') return '/?immediate_delivery=true';
    if (section.criteria_type === 'category' && section.criteria_value)
      return `/?category=${encodeURIComponent(section.criteria_value)}`;
    return null;
  })();

  if (section.products.length === 0) return null;

  return (
    <div className="overflow-hidden border border-zinc-200 bg-white shadow-sm">
      {/* Card — click to expand/collapse */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left focus:outline-none"
      >
        {/* Title bar */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ backgroundColor: bgColor }}
        >
          <div className="min-w-0">
            <p className="text-base font-extrabold tracking-tight leading-tight truncate" style={{ color: textColor }}>
              {section.title}
            </p>
            {section.subtitle && (
              <p className="text-xs opacity-75 mt-0.5 truncate" style={{ color: textColor }}>
                {section.subtitle}
              </p>
            )}
          </div>
          <ChevronDown
            className="ml-3 h-4 w-4 shrink-0 transition-transform duration-200"
            style={{
              color: textColor,
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </div>
      </button>

      {/* Expanded: products + filter link */}
      {expanded && (
        <div className="border-t border-zinc-100">
          {/* Products horizontal scroll */}
          <div className="overflow-x-auto scrollbar-hide py-3 px-3">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {section.products.map((product) => {
                const primaryImage =
                  product.images.find((img) => img.is_primary) || product.images[0];
                return (
                  <Link
                    key={product.id}
                    href={`/producto/${product.slug}`}
                    className="group block bg-white border border-zinc-200 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
                    style={{ width: '140px' }}
                  >
                    <div className="aspect-square relative overflow-hidden bg-zinc-50">
                      {primaryImage ? (
                        <img
                          src={primaryImage.url}
                          alt={primaryImage.alt_text || product.name}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-zinc-300">
                          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-2">
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

          {/* "Ver todos" footer link for filterable sections */}
          {filterHref && (
            <div className="border-t border-zinc-100">
              <Link
                href={filterHref}
                className="flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
              >
                Ver todos →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
