'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Package, Eye, EyeOff, TrendingUp, ChevronRight, ChevronDown, ExternalLink, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useSourceWebsites } from '@/hooks/useProducts';
import { useQuery } from '@tanstack/react-query';

interface PriceRangeProduct {
  id: number;
  name: string;
  original_name: string;
  price: number | null;
  sku: string | null;
  source_name: string | null;
  image: string | null;
}

interface PriceRange {
  key: string;
  label: string;
  min: number;
  max: number | null;
  count: number;
  products: PriceRangeProduct[];
}

interface PriceRangeResponse {
  ranges: PriceRange[];
}

export default function AdminDashboard() {
  const apiKey = useApiKey();
  const [expandedRanges, setExpandedRanges] = useState<Set<string>>(new Set());

  // Get counts for enabled/disabled
  const { data: enabledData } = useAdminProducts(apiKey || '', { limit: 1, enabled: true });
  const { data: disabledData } = useAdminProducts(apiKey || '', { limit: 1, enabled: false });
  const { data: sourceWebsites } = useSourceWebsites(apiKey || '');

  // Get price range stats
  const { data: priceRangeData } = useQuery<PriceRangeResponse>({
    queryKey: ['admin-stats-by-price-range'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/stats/by-price-range`,
        {
          headers: { 'X-Admin-API-Key': apiKey || '' },
        }
      );
      if (!response.ok) throw new Error('Error fetching price range stats');
      return response.json();
    },
    enabled: !!apiKey,
  });

  const enabledCount = enabledData?.total || 0;
  const disabledCount = disabledData?.total || 0;
  const totalProducts = enabledCount + disabledCount;

  const toggleRange = (key: string) => {
    const newExpanded = new Set(expandedRanges);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedRanges(newExpanded);
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Colors for price ranges
  const rangeColors: Record<string, { bg: string; text: string; border: string }> = {
    '0-5000': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    '5001-20000': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    '20001-80000': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    '80001+': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Resumen de tu catalogo</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Productos</p>
                <p className="text-2xl font-bold text-gray-900">{totalProducts}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Eye className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Habilitados</p>
                <p className="text-2xl font-bold text-gray-900">{enabledCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-100 rounded-lg">
                <EyeOff className="h-6 w-6 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Deshabilitados</p>
                <p className="text-2xl font-bold text-gray-900">{disabledCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Webs de Origen</p>
                <p className="text-2xl font-bold text-gray-900">{sourceWebsites?.items.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Price Range Stats */}
      {priceRangeData && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Productos por Rango de Precio
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              Solo productos habilitados. Click para ver detalle.
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {priceRangeData.ranges.map((range) => {
                const isExpanded = expandedRanges.has(range.key);
                const colors = rangeColors[range.key] || { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

                return (
                  <div key={range.key} className={`border rounded-lg overflow-hidden ${colors.border}`}>
                    {/* Range header - clickable */}
                    <button
                      onClick={() => toggleRange(range.key)}
                      className={`w-full px-4 py-3 flex items-center justify-between hover:opacity-80 transition-opacity ${colors.bg}`}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className={`h-5 w-5 ${colors.text}`} />
                        ) : (
                          <ChevronRight className={`h-5 w-5 ${colors.text}`} />
                        )}
                        <span className={`font-medium ${colors.text}`}>
                          {range.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-2xl font-bold ${colors.text}`}>
                          {range.count}
                        </span>
                        <span className="text-sm text-gray-500">productos</span>
                      </div>
                    </button>

                    {/* Expanded content - products list */}
                    {isExpanded && range.products.length > 0 && (
                      <div className="border-t bg-white">
                        <table className="min-w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Producto
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Fuente
                              </th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                Precio
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {range.products.map((product) => (
                              <tr key={product.id} className="hover:bg-gray-50">
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-2">
                                    {product.image && (
                                      <img
                                        src={product.image}
                                        alt=""
                                        className="w-8 h-8 object-cover rounded"
                                      />
                                    )}
                                    <Link
                                      href={`/admin/productos/${product.id}`}
                                      className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                    >
                                      <span className="line-clamp-1">{product.name}</span>
                                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                    </Link>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-gray-600">
                                  {product.source_name || '-'}
                                </td>
                                <td className="px-4 py-2 text-right font-medium text-gray-900">
                                  {formatPrice(product.price)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {range.count > range.products.length && (
                          <div className="px-4 py-2 text-center text-sm text-gray-500 border-t">
                            Mostrando {range.products.length} de {range.count} productos
                          </div>
                        )}
                      </div>
                    )}

                    {isExpanded && range.products.length === 0 && (
                      <div className="border-t bg-white px-4 py-4 text-center text-gray-500">
                        No hay productos en este rango
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Websites */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">
            Webs de Origen
          </h2>
        </CardHeader>
        <CardContent>
          {sourceWebsites?.items && sourceWebsites.items.length > 0 ? (
            <ul className="space-y-2">
              {sourceWebsites.items.map((website) => (
                <li
                  key={website.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {website.display_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {website.enabled_product_count} activos / {website.product_count} total
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      website.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {website.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-center py-4">
              No hay webs de origen configuradas
            </p>
          )}
          <Link
            href="/admin/source-websites"
            className="block mt-4 text-center text-sm text-primary-600 hover:text-primary-700"
          >
            Gestionar webs de origen <ChevronRight className="inline h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
