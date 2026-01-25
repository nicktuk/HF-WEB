'use client';

import { useState } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  formatPrice,
  formatPercentage,
  formatRelativeTime,
  getCompetitivenessColor,
  getCompetitivenessLabel,
} from '@/lib/utils';
import { useMarketPrices, useRefreshMarketPrices, usePriceComparison } from '@/hooks/useProducts';
import type { ProductAdmin } from '@/types';

interface PriceIntelligenceProps {
  product: ProductAdmin;
  apiKey: string;
  onMarkupChange?: (markup: number) => void;
}

export function PriceIntelligence({
  product,
  apiKey,
  onMarkupChange,
}: PriceIntelligenceProps) {
  const [markup, setMarkup] = useState(Number(product.markup_percentage));

  const { data: marketStats, isLoading: loadingStats } = useMarketPrices(apiKey, product.id);
  const { data: comparison, isLoading: loadingComparison } = usePriceComparison(apiKey, product.id);
  const refreshMutation = useRefreshMarketPrices(apiKey);

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

  const handleRefresh = () => {
    refreshMutation.mutate({ productId: product.id, options: { force: true } });
  };

  // Calculate position on price bar
  const getPositionPercentage = () => {
    if (!marketStats?.min_price || !marketStats?.max_price) return 50;
    const range = Number(marketStats.max_price) - Number(marketStats.min_price);
    if (range === 0) return 50;
    const position = ((finalPrice - Number(marketStats.min_price)) / range) * 100;
    return Math.max(0, Math.min(100, position));
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
          <div className="text-center mb-4">
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
          </div>

          {/* Market Position Bar */}
          {loadingStats ? (
            <Skeleton className="h-16 w-full" />
          ) : marketStats && marketStats.sample_count > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">
                Posición en el mercado
              </p>

              {/* Price labels */}
              <div className="flex justify-between text-xs text-gray-500">
                <span>{formatPrice(marketStats.min_price)}</span>
                <span>{formatPrice(marketStats.avg_price)}</span>
                <span>{formatPrice(marketStats.max_price)}</span>
              </div>

              {/* Bar */}
              <div className="relative h-3 bg-gradient-to-r from-green-200 via-yellow-200 to-red-200 rounded-full">
                {/* Average marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-400"
                  style={{ left: '50%' }}
                />

                {/* Your price marker */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary-600 border-2 border-white rounded-full shadow"
                  style={{ left: `${getPositionPercentage()}%`, transform: 'translate(-50%, -50%)' }}
                />
              </div>

              {/* Labels */}
              <div className="flex justify-between text-xs text-gray-500">
                <span>MIN</span>
                <span>PROMEDIO</span>
                <span>MAX</span>
              </div>

              {/* Competitiveness indicator */}
              {comparison && (
                <div className="flex items-center gap-2 mt-3">
                  {comparison.competitiveness === 'competitive' || comparison.competitiveness === 'below_market' ? (
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  ) : comparison.competitiveness === 'moderate' ? (
                    <Minus className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${getCompetitivenessColor(comparison.competitiveness)}`}>
                    {getCompetitivenessLabel(comparison.competitiveness)}
                  </span>
                  {comparison.vs_avg_percentage !== undefined && (
                    <span className="text-sm text-gray-500">
                      ({formatPercentage(comparison.vs_avg_percentage)} vs promedio)
                    </span>
                  )}
                </div>
              )}

              {/* Stats summary */}
              <p className="text-xs text-gray-500 mt-2">
                {marketStats.sample_count} productos comparados de {marketStats.sources_count} fuentes
                {marketStats.last_updated && (
                  <span> · Actualizado {formatRelativeTime(marketStats.last_updated)}</span>
                )}
              </p>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500">
              <p className="text-sm">No hay datos de mercado disponibles</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                isLoading={refreshMutation.isPending}
                className="mt-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Buscar precios de mercado
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Refresh button */}
      {marketStats && marketStats.sample_count > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          isLoading={refreshMutation.isPending}
          className="w-full"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar precios de mercado
        </Button>
      )}
    </div>
  );
}
