'use client';

import { useState } from 'react';
import { Star, LogIn } from 'lucide-react';
import type { ProductReview } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

function StarRow({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-3.5 h-3.5' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${sizeClass} ${value >= i - 0.5 ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );
}

export function ProductRatingSummary({
  ratingAvg,
  ratingCount,
  unitsSold,
}: {
  ratingAvg: number | null | undefined;
  ratingCount: number | undefined;
  unitsSold: number | undefined;
}) {
  const count = ratingCount ?? 0;
  const sold = unitsSold ?? 0;
  if (count === 0 && sold === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
      {count > 0 && (
        <div className="flex items-center gap-1.5">
          <StarRow value={ratingAvg ?? 0} size="sm" />
          <span className="text-sm font-semibold text-gray-700">{(ratingAvg ?? 0).toFixed(1)}</span>
          <span className="text-sm text-gray-500">
            ({count} calificaci{count === 1 ? 'ón' : 'ones'})
          </span>
        </div>
      )}
      {sold > 0 && (
        <span className="text-sm text-gray-500">
          {count > 0 && '· '}{sold.toLocaleString('es-AR')} vendidos
        </span>
      )}
    </div>
  );
}

function RatingGate() {
  const [hovered, setHovered] = useState(0);
  const [showLoginNotice, setShowLoginNotice] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 mb-5">
      <p className="text-sm font-medium text-gray-800 mb-2">¿Ya lo compraste? Calificá este producto</p>
      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            onMouseEnter={() => setHovered(i)}
            onClick={() => setShowLoginNotice(true)}
            aria-label={`Calificar con ${i} estrella${i > 1 ? 's' : ''}`}
            className="p-0.5"
          >
            <Star className={`w-6 h-6 transition-colors ${hovered >= i ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
          </button>
        ))}
      </div>
      {showLoginNotice && (
        <p className="mt-2.5 flex items-center gap-1.5 text-sm text-red-600">
          <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
          Necesitás iniciar sesión para calificar este producto.
        </p>
      )}
    </div>
  );
}

export function ProductReviews({ reviews }: { reviews: ProductReview[] | undefined }) {
  const list = reviews ?? [];

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Calificaciones de clientes</h2>

      <RatingGate />

      {list.length > 0 ? (
        <ul className="divide-y divide-gray-100">
          {list.map((r) => (
            <li key={r.id} className="py-3.5 first:pt-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium text-gray-800">{r.reviewer_name}</span>
                <span className="text-xs text-gray-400">{formatRelativeTime(r.created_at)}</span>
              </div>
              <StarRow value={r.rating} size="sm" />
              {r.comment && <p className="mt-1.5 text-sm text-gray-600 leading-relaxed">{r.comment}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">Todavía no hay calificaciones para este producto.</p>
      )}
    </div>
  );
}
