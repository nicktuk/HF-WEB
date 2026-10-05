'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatPrice } from '@/lib/utils';
import type { ProductAdmin } from '@/types';

interface MarkupEditorProps {
  product: ProductAdmin;
  onMarkupChange?: (markup: number) => void;
}

export function MarkupEditor({
  product,
  onMarkupChange,
}: MarkupEditorProps) {
  const [markup, setMarkup] = useState(Number(product.markup_percentage));

  const originalPrice = Number(product.original_price) || 0;
  const hasCustomPrice = !!(product.custom_price && Number(product.custom_price) > 0);
  const finalPrice = hasCustomPrice
    ? Number(product.custom_price)
    : originalPrice * (1 + markup / 100);

  const handleMarkupChange = (newMarkup: number) => {
    const clamped = Math.max(0, newMarkup);
    setMarkup(clamped);
    onMarkupChange?.(clamped);
  };

  return (
    <div className="space-y-4">
      {/* Original Price */}
      <div>
        <p className="text-sm text-gray-500">Precio de origen</p>
        <p className="text-2xl font-bold text-gray-900">
          {formatPrice(originalPrice)}
        </p>
      </div>

      {/* Markup Slider */}
      <div className={`space-y-2 ${hasCustomPrice ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">Markup</label>
          {hasCustomPrice && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              Ignorado (precio fijo activo)
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMarkupChange(markup - 5)}
            disabled={markup <= 0 || hasCustomPrice}
          >
            -5%
          </Button>

          <div className="flex-1">
            <input
              type="range"
              min="0"
              max="200"
              step="1"
              value={Math.min(markup, 200)}
              onChange={(e) => handleMarkupChange(Number(e.target.value))}
              disabled={hasCustomPrice}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600 disabled:cursor-not-allowed"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>0%</span>
              <input
                type="number"
                min="0"
                value={markup}
                onChange={(e) => handleMarkupChange(Number(e.target.value) || 0)}
                disabled={hasCustomPrice}
                className="w-16 text-center font-medium text-gray-900 border rounded px-1 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <span>200%+</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleMarkupChange(markup + 5)}
            disabled={hasCustomPrice}
          >
            +5%
          </Button>
        </div>
      </div>

      {/* Final Price */}
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Tu precio {hasCustomPrice && <span className="text-amber-600">(fijo)</span>}
            </p>
            <p className="text-4xl font-bold text-gray-900">
              {formatPrice(finalPrice)}
            </p>
            {!hasCustomPrice && originalPrice > 0 && (
              <p className="text-xs text-gray-400 mt-1">
                {formatPrice(originalPrice)} + {markup}% markup
              </p>
            )}
            {originalPrice > 0 && (
              <p className="text-sm font-medium text-emerald-600 mt-2">
                Ganancia bruta: {((finalPrice - originalPrice) / finalPrice * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
