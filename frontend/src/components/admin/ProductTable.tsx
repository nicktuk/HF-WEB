'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { MoreVertical, Edit, RefreshCw, Trash2, Eye, EyeOff, Star, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableRowSkeleton } from '@/components/ui/skeleton';
import { formatPrice, formatRelativeTime } from '@/lib/utils';
import { useUpdateProduct, useDeleteProduct, useRescrapeProduct } from '@/hooks/useProducts';
import type { ProductAdmin } from '@/types';

interface ProductTableProps {
  products: ProductAdmin[];
  isLoading?: boolean;
  apiKey: string;
  selectedIds?: number[];
  onSelectionChange?: (ids: number[]) => void;
  categories?: string[];
}

export function ProductTable({ products, isLoading, apiKey, selectedIds = [], onSelectionChange, categories = [] }: ProductTableProps) {
  const updateMutation = useUpdateProduct(apiKey);
  const deleteMutation = useDeleteProduct(apiKey);
  const rescrapeMutation = useRescrapeProduct(apiKey);

  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const handleCategoryChange = async (product: ProductAdmin, newCategory: string) => {
    if (newCategory === (product.category || '')) return;
    await updateMutation.mutateAsync({
      id: product.id,
      data: { category: newCategory || null },
    });
  };

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

  const allSelected = products.length > 0 && products.every(p => selectedIds.includes(p.id));
  const someSelected = products.some(p => selectedIds.includes(p.id)) && !allSelected;

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
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mercado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Acciones</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRowSkeleton key={i} columns={6} />
            ))}
          </tbody>
        </table>
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
    <div className="overflow-x-auto bg-white rounded-lg border">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSelectionChange && (
              <th className="px-4 py-3 w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
              </th>
            )}
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Producto
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Categoría
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio Origen
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Markup
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Precio Final
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Mercado
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {products.map((product) => {
            const primaryImage = product.images.find((img) => img.is_primary) || product.images[0];
            const finalPrice = product.custom_price
              ? Number(product.custom_price)
              : (Number(product.original_price) || 0) * (1 + Number(product.markup_percentage) / 100);

            return (
              <tr key={product.id} className="hover:bg-gray-50">
                {/* Checkbox */}
                {onSelectionChange && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={(e) => handleSelectOne(product.id, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  </td>
                )}
                {/* Product */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-gray-100 overflow-hidden">
                      {primaryImage ? (
                        <Image
                          src={primaryImage.url}
                          alt={product.name}
                          width={48}
                          height={48}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-400">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/admin/productos/${product.id}`}
                        className="font-medium text-gray-900 hover:text-primary-600 line-clamp-1"
                      >
                        {product.custom_name || product.original_name}
                      </Link>
                      <p className="text-xs text-gray-500">{product.slug}</p>
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td className="px-4 py-3 text-sm">
                  <select
                    value={product.category || ''}
                    onChange={(e) => handleCategoryChange(product, e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-200 rounded hover:border-gray-300 focus:ring-1 focus:ring-primary-500 focus:border-primary-500 bg-transparent cursor-pointer"
                    disabled={updateMutation.isPending}
                  >
                    <option value="">Sin categoría</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </td>

                {/* Original Price */}
                <td className="px-4 py-3 text-sm text-gray-900">
                  {formatPrice(product.original_price)}
                </td>

                {/* Markup */}
                <td className="px-4 py-3 text-sm text-gray-900">
                  {Number(product.markup_percentage)}%
                </td>

                {/* Final Price */}
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold text-gray-900">
                    {formatPrice(finalPrice)}
                  </span>
                </td>

                {/* Market */}
                <td className="px-4 py-3 text-sm">
                  {product.market_avg_price ? (
                    <div>
                      <span className="text-gray-900">{formatPrice(product.market_avg_price)}</span>
                      <span className="text-xs text-gray-500 block">
                        {product.market_sample_count} muestras
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <Badge variant={product.enabled ? 'success' : 'default'}>
                    {product.enabled ? 'Activo' : 'Inactivo'}
                  </Badge>
                </td>

                {/* Actions */}
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleEnabled(product)}
                      title={product.enabled ? 'Desactivar' : 'Activar'}
                    >
                      {product.enabled ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleFeatured(product)}
                      title={product.is_featured ? 'Quitar de Nuevo' : 'Marcar como Nuevo'}
                      className={product.is_featured ? 'text-amber-600' : undefined}
                    >
                      <Star className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleImmediate(product)}
                      title={product.is_immediate_delivery ? 'Quitar Entrega inmediata' : 'Marcar Entrega inmediata'}
                      className={product.is_immediate_delivery ? 'text-emerald-600' : undefined}
                    >
                      <Zap className="h-4 w-4" />
                    </Button>

                    <Link href={`/admin/productos/${product.id}`}>
                      <Button variant="ghost" size="sm" title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>

                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpenMenu(openMenu === product.id ? null : product.id)}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>

                      {openMenu === product.id && (
                        <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border z-10">
                          <button
                            onClick={() => handleRescrape(product.id)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                            disabled={rescrapeMutation.isPending}
                          >
                            <RefreshCw className="h-4 w-4" />
                            Re-scrapear
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
