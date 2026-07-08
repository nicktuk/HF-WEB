'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, Edit, RefreshCw, Trash2, Star, Zap, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUpdateProduct, useDeleteProduct, useRescrapeProduct } from '@/hooks/useProducts';
import { resolveImageUrl } from '@/lib/api';
import type { ProductAdmin } from '@/types';

interface ProductTableProps {
  products: ProductAdmin[];
  isLoading?: boolean;
  apiKey: string;
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
}

const GRID_CLASSES = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3';

export function ProductTable({ products, isLoading, apiKey, selectedIds = [], onSelectionChange }: ProductTableProps) {
  const updateMutation = useUpdateProduct(apiKey);
  const deleteMutation = useDeleteProduct(apiKey);
  const rescrapeMutation = useRescrapeProduct(apiKey);

  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const allSelected = products.length > 0 && products.every(p => selectedIds.includes(p.id));
  const someSelected = products.some(p => selectedIds.includes(p.id)) && !allSelected;

  const handleSelectAll = (checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(checked ? products.map(p => p.id) : []);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (onSelectionChange) {
      if (checked) {
        onSelectionChange([...selectedIds, id]);
      } else {
        onSelectionChange(selectedIds.filter(i => i !== id));
      }
    }
  };

  const handleToggleEnabled = async (product: ProductAdmin) => {
    await updateMutation.mutateAsync({
      id: product.id,
      data: { enabled: !product.enabled },
    });
  };

  const handleToggleFeatured = async (product: ProductAdmin) => {
    await updateMutation.mutateAsync({
      id: product.id,
      data: { is_featured: !product.is_featured },
    });
  };

  const handleToggleImmediate = async (product: ProductAdmin) => {
    await updateMutation.mutateAsync({
      id: product.id,
      data: { is_immediate_delivery: !product.is_immediate_delivery },
    });
  };

  const handleToggleCheckStock = async (product: ProductAdmin) => {
    await updateMutation.mutateAsync({
      id: product.id,
      data: { is_check_stock: !product.is_check_stock },
    });
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await deleteMutation.mutateAsync(id);
    }
  };

  const handleRescrape = async (id: number) => {
    await rescrapeMutation.mutateAsync(id);
    setOpenMenu(null);
  };

  if (isLoading) {
    return (
      <div className={GRID_CLASSES}>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-white border rounded-lg p-3 animate-pulse space-y-2">
            <div className="aspect-square w-full rounded-lg bg-gray-200" />
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border">
        <p className="text-gray-500">No hay productos</p>
      </div>
    );
  }

  return (
    <div>
      {onSelectionChange && (
        <label className="flex items-center gap-2 mb-3 text-sm text-gray-600 w-fit cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => { if (el) el.indeterminate = someSelected; }}
            onChange={(e) => handleSelectAll(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          Seleccionar todos ({products.length})
        </label>
      )}
      <div className={GRID_CLASSES}>
      {products.map((product) => {
        const primaryImage = product.images.find((img) => img.is_primary) || product.images[0];
        const stockQty = product.stock_qty || 0;
        const hasStock = stockQty > 0;

        return (
          <div key={product.id} className="relative bg-white border rounded-lg p-3 flex flex-col gap-2">
            {onSelectionChange && (
              <input
                type="checkbox"
                checked={selectedIds.includes(product.id)}
                onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                className="absolute top-2 left-2 z-10 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 bg-white"
              />
            )}

            <Link href={`/admin/productos/${product.id}`} className="block aspect-square w-full rounded-lg bg-gray-100 overflow-hidden">
              {primaryImage ? (
                <Image
                  src={resolveImageUrl(primaryImage.url) ?? primaryImage.url}
                  alt={product.display_name_with_code}
                  width={200}
                  height={200}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-gray-400">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
            </Link>

            <Link
              href={`/admin/productos/${product.id}`}
              className={`text-sm font-medium leading-snug ${hasStock ? 'text-emerald-700 hover:text-emerald-800' : 'text-gray-900 hover:text-primary-600'}`}
            >
              {product.display_name_with_code}
            </Link>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleToggleEnabled(product)}
                title={product.enabled ? 'Desactivar' : 'Activar'}
                className="hover:scale-110 transition-transform"
              >
                {product.enabled ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
              </button>
              <button
                onClick={() => handleToggleFeatured(product)}
                title={product.is_featured ? 'Quitar de Nuevo' : 'Marcar como Nuevo'}
                className="hover:scale-110 transition-transform"
              >
                <Star className={`h-4 w-4 ${product.is_featured ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
              </button>
              <button
                onClick={() => handleToggleImmediate(product)}
                title={product.is_immediate_delivery ? 'Quitar Entrega inmediata' : 'Marcar Entrega inmediata'}
                className="hover:scale-110 transition-transform"
              >
                <Zap className={`h-4 w-4 ${product.is_immediate_delivery ? 'text-emerald-600 fill-emerald-600' : 'text-gray-400'}`} />
              </button>
              <button
                onClick={() => handleToggleCheckStock(product)}
                title={product.is_check_stock ? 'Quitar Consultar stock' : 'Marcar Consultar stock'}
                className="hover:scale-110 transition-transform"
              >
                <HelpCircle className={`h-4 w-4 ${product.is_check_stock ? 'text-orange-500 fill-orange-500' : 'text-gray-400'}`} />
              </button>
            </div>

            <div className="flex items-center justify-center py-1">
              <span
                className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-semibold ${
                  hasStock ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'
                }`}
                title={`Stock: ${stockQty}`}
              >
                {stockQty}
              </span>
            </div>

            <div className="flex items-center gap-2 mt-auto">
              <Link href={`/admin/productos/${product.id}`} className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  <Edit className="h-4 w-4" />
                </Button>
              </Link>

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpenMenu(openMenu === product.id ? null : product.id)}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>

                {openMenu === product.id && (
                  <div className="absolute right-0 bottom-full mb-1 w-48 bg-white rounded-lg shadow-lg border z-20">
                    <button
                      onClick={() => handleRescrape(product.id)}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 rounded-t-lg"
                      disabled={rescrapeMutation.isPending}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Re-scrapear
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 rounded-b-lg border-t"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
