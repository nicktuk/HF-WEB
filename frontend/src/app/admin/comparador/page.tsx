'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Loader2, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useAuth';

interface Source {
  id: number;
  name: string;
}

interface ComparatorProduct {
  id: number;
  name: string;
  original_name: string;
  sku: string | null;
  slug: string;
  source_website_id: number;
  source_name: string;
  original_price: number | null;
  final_price: number | null;
  markup_percentage: number;
  enabled: boolean;
  image: string | null;
}

interface ProductGroup {
  name: string;
  products: ComparatorProduct[];
}

interface ComparatorResult {
  sources: Source[];
  groups: ProductGroup[];
  total: number;
}

export default function ComparadorPage() {
  const apiKey = useApiKey() || '';
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ComparatorResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const handleSearch = async () => {
    if (!search.trim() || search.trim().length < 2) {
      setError('Ingresa al menos 2 caracteres para buscar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/price-comparator?search=${encodeURIComponent(search.trim())}`,
        {
          headers: {
            'X-Admin-API-Key': apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al buscar productos');
      }

      const data: ComparatorResult = await response.json();
      setResult(data);
      // Expand groups with multiple sources by default
      const multiSourceGroups = new Set<number>();
      data.groups.forEach((g, idx) => {
        if (g.products.length > 1) {
          multiSourceGroups.add(idx);
        }
      });
      setExpandedGroups(multiSourceGroups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const toggleGroup = (idx: number) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedGroups(newExpanded);
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return '-';
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  // Separate groups into comparable (multiple sources) and single-source
  const comparableGroups = result?.groups.filter(g => g.products.length > 1) || [];
  const singleSourceGroups = result?.groups.filter(g => g.products.length === 1) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comparador de Precios</h1>
        <p className="text-gray-600">
          Busca un producto y compara precios entre webs de origen
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-4 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="search"
            placeholder="Buscar productos (ej: remera, pantalon, vestido...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleKeyPress}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Buscar'
          )}
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{result.total} productos encontrados</span>
            <span className="text-gray-300">|</span>
            <span className="text-green-600 font-medium">
              {comparableGroups.length} comparables (en varias fuentes)
            </span>
            <span className="text-gray-300">|</span>
            <span>{singleSourceGroups.length} en una sola fuente</span>
          </div>

          {result.total === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No se encontraron productos para &quot;{search}&quot;
            </div>
          ) : (
            <>
              {/* Comparable products (multiple sources) */}
              {comparableGroups.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Productos comparables
                  </h2>
                  <div className="space-y-3">
                    {comparableGroups.map((group, idx) => {
                      const isExpanded = expandedGroups.has(idx);
                      const prices = group.products
                        .map(p => p.original_price)
                        .filter((p): p is number => p !== null);
                      const minPrice = prices.length > 0 ? Math.min(...prices) : null;
                      const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
                      const priceDiff = minPrice && maxPrice ? maxPrice - minPrice : 0;
                      const priceDiffPercent = minPrice && maxPrice && minPrice > 0
                        ? Math.round(((maxPrice - minPrice) / minPrice) * 100)
                        : 0;

                      return (
                        <div
                          key={idx}
                          className="bg-white border border-gray-200 rounded-lg overflow-hidden"
                        >
                          {/* Group header */}
                          <button
                            onClick={() => toggleGroup(idx)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                              )}
                              <span className="font-medium text-gray-900">
                                {group.name}
                              </span>
                              <span className="text-sm text-gray-500">
                                ({group.products.length} fuentes)
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="text-green-600 font-medium">
                                Min: {formatPrice(minPrice)}
                              </span>
                              <span className="text-red-600 font-medium">
                                Max: {formatPrice(maxPrice)}
                              </span>
                              {priceDiffPercent > 0 && (
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  priceDiffPercent > 20
                                    ? 'bg-red-100 text-red-700'
                                    : priceDiffPercent > 10
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {priceDiffPercent}% diferencia
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="border-t border-gray-200">
                              <table className="min-w-full">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Fuente
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                      Nombre original
                                    </th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                      Precio origen
                                    </th>
                                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                                      Precio venta
                                    </th>
                                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                                      Estado
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {group.products
                                    .sort((a, b) => (a.original_price || 0) - (b.original_price || 0))
                                    .map((product) => {
                                      const isMin = product.original_price === minPrice;
                                      const isMax = product.original_price === maxPrice;

                                      return (
                                        <tr
                                          key={product.id}
                                          className={`${
                                            isMin ? 'bg-green-50' : isMax ? 'bg-red-50' : ''
                                          }`}
                                        >
                                          <td className="px-4 py-2">
                                            <div className="flex items-center gap-2">
                                              {product.image && (
                                                <img
                                                  src={product.image}
                                                  alt=""
                                                  className="w-14 h-14 object-cover rounded"
                                                />
                                              )}
                                              <span className="font-medium text-gray-900">
                                                {product.source_name}
                                              </span>
                                            </div>
                                          </td>
                                          <td className="px-4 py-2 text-sm">
                                            <Link
                                              href={`/admin/productos/${product.id}`}
                                              className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                            >
                                              {product.original_name}
                                              <ExternalLink className="h-3 w-3" />
                                            </Link>
                                            {product.sku && (
                                              <span className="text-xs text-gray-400 ml-2">
                                                SKU: {product.sku}
                                              </span>
                                            )}
                                          </td>
                                          <td className={`px-4 py-2 text-right font-semibold ${
                                            isMin ? 'text-green-700' : isMax ? 'text-red-700' : 'text-gray-900'
                                          }`}>
                                            {formatPrice(product.original_price)}
                                          </td>
                                          <td className="px-4 py-2 text-right text-gray-600">
                                            {formatPrice(product.final_price)}
                                          </td>
                                          <td className="px-4 py-2 text-center">
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                              product.enabled
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-500'
                                            }`}>
                                              {product.enabled ? 'Activo' : 'Inactivo'}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Single source products */}
              {singleSourceGroups.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-gray-500">
                    Solo en una fuente ({singleSourceGroups.length})
                  </h2>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Producto
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            Fuente
                          </th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                            Precio origen
                          </th>
                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                            Estado
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {singleSourceGroups.map((group) => {
                          const product = group.products[0];
                          return (
                            <tr key={product.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  {product.image && (
                                    <img
                                      src={product.image}
                                      alt=""
                                      className="w-12 h-12 object-cover rounded"
                                    />
                                  )}
                                  <Link
                                    href={`/admin/productos/${product.id}`}
                                    className="text-sm text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                                  >
                                    {product.name}
                                    <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </div>
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-600">
                                {product.source_name}
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-gray-900">
                                {formatPrice(product.original_price)}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                  product.enabled
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {product.enabled ? 'Activo' : 'Inactivo'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Initial state */}
      {!result && !error && !isLoading && (
        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
          <Search className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Ingresa una palabra clave para buscar productos</p>
          <p className="text-sm mt-1">Se agruparan productos similares de diferentes fuentes</p>
        </div>
      )}
    </div>
  );
}
