'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Package, Eye, EyeOff, TrendingUp, ChevronRight, ChevronDown, ExternalLink, DollarSign, Boxes, Truck, CreditCard, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useSourceWebsites, usePurchasesByPayer } from '@/hooks/useProducts';
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

interface StockByCategoryItem {
  category: string;
  stock_qty: number;
  stock_value: number;
}

interface StockByCategoryResponse {
  total_qty: number;
  total_value: number;
  items: StockByCategoryItem[];
}

interface SellerStats {
  collected: number;
  pending_delivery: number;
  pending_payment: number;
}

interface FinancialStatsResponse {
  total_purchased: number;
  total_collected: number;
  total_pending_delivery: number;
  total_pending_payment: number;
  stock_value_cost: number;
  by_seller?: Record<string, SellerStats>;
}

export default function AdminDashboard() {
  const apiKey = useApiKey();
  const [expandedRanges, setExpandedRanges] = useState<Set<string>>(new Set());
  const [showSellerStats, setShowSellerStats] = useState(false);
  const [showPayerStats, setShowPayerStats] = useState(false);

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

  const { data: stockByCategory } = useQuery<StockByCategoryResponse>({
    queryKey: ['admin-stats-stock-by-category'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/stats/stock-by-category`,
        {
          headers: { 'X-Admin-API-Key': apiKey || '' },
        }
      );
      if (!response.ok) throw new Error('Error fetching stock stats');
      return response.json();
    },
    enabled: !!apiKey,
  });

  const { data: financialStats } = useQuery<FinancialStatsResponse>({
    queryKey: ['admin-stats-financials'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/stats/financials`,
        {
          headers: { 'X-Admin-API-Key': apiKey || '' },
        }
      );
      if (!response.ok) throw new Error('Error fetching financial stats');
      return response.json();
    },
    enabled: !!apiKey,
  });

  const { data: purchasesByPayer } = usePurchasesByPayer(apiKey || '');

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

  const formatPct = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const projections = useMemo(() => {
    if (!financialStats) return null;

    const invested = Number(financialStats.total_purchased || 0);
    const stockCost = Number(financialStats.stock_value_cost || 0);
    const totalSales =
      Number(financialStats.total_collected || 0) +
      Number(financialStats.total_pending_payment || 0) +
      Number(financialStats.total_pending_delivery || 0);

    const stock50 = stockCost * 1.5;
    const stock70 = stockCost * 1.7;

    const gainVsInvested = totalSales - invested;
    const gainPctVsInvested = invested > 0 ? (gainVsInvested / invested) * 100 : 0;

    const scenarios = [
      {
        key: 'costo',
        label: 'Ventas + Stock costo',
        total: totalSales + stockCost,
      },
      {
        key: 'm50',
        label: 'Ventas + Stock +50%',
        total: totalSales + stock50,
      },
      {
        key: 'm70',
        label: 'Ventas + Stock +70%',
        total: totalSales + stock70,
      },
    ].map((scenario) => {
      const diff = scenario.total - invested;
      const pct = invested > 0 ? (diff / invested) * 100 : 0;
      return { ...scenario, diff, pct };
    });

    return {
      invested,
      totalSales,
      stockCost,
      stock50,
      stock70,
      gainVsInvested,
      gainPctVsInvested,
      scenarios,
    };
  }, [financialStats]);

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
                                        className="w-12 h-12 object-cover rounded"
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

      {/* Financial Stats */}
      {financialStats && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Resumen financiero
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              Valores de ventas y stock a costo origen. Click en los KPIs de ventas para ver detalle por vendedor.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Inversion + Stock</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setShowPayerStats(!showPayerStats)}
                    className="rounded-lg border bg-white p-3 text-left hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 uppercase">Total comprado</p>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${showPayerStats ? 'rotate-180' : ''}`} />
                    </div>
                    <p className="text-xl font-bold text-slate-900 mt-1">{formatPrice(financialStats.total_purchased)}</p>
                  </button>
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-xs text-blue-600 uppercase">Stock a costo</p>
                    <p className="text-xl font-bold text-blue-700 mt-1">{formatPrice(financialStats.stock_value_cost)}</p>
                  </div>
                </div>

                {projections && (
                  <>
                    <div className="rounded-lg border bg-white p-3">
                      <p className="text-xs text-gray-500 uppercase">Stock valorizado proyectado</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">A costo</span>
                          <span className="font-semibold text-gray-900">{formatPrice(projections.stockCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">A +50%</span>
                          <span className="font-semibold text-gray-900">{formatPrice(projections.stock50)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">A +70%</span>
                          <span className="font-semibold text-gray-900">{formatPrice(projections.stock70)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="rounded-xl border bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-emerald-700 uppercase tracking-wide">Ventas y Estadios</h3>
                {projections && (
                  <div className="rounded-lg border bg-white p-3">
                    <p className="text-xs text-gray-500 uppercase">Suma de ventas</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{formatPrice(projections.totalSales)}</p>
                    <p className={`text-sm mt-2 ${projections.gainVsInvested >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Ganancia vs compras: {formatPrice(projections.gainVsInvested)} ({formatPct(projections.gainPctVsInvested)})
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    onClick={() => setShowSellerStats(!showSellerStats)}
                    className="rounded-lg border bg-white p-3 text-left hover:bg-emerald-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-emerald-600 uppercase">Total cobrado</p>
                      <ChevronDown className={`h-4 w-4 text-emerald-400 transition-transform ${showSellerStats ? 'rotate-180' : ''}`} />
                    </div>
                    <p className="text-xl font-bold text-emerald-700 mt-1">{formatPrice(financialStats.total_collected)}</p>
                  </button>
                  <button
                    onClick={() => setShowSellerStats(!showSellerStats)}
                    className="rounded-lg border bg-white p-3 text-left hover:bg-amber-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-amber-600 uppercase">Pend. entrega</p>
                      <ChevronDown className={`h-4 w-4 text-amber-400 transition-transform ${showSellerStats ? 'rotate-180' : ''}`} />
                    </div>
                    <p className="text-xl font-bold text-amber-700 mt-1">{formatPrice(financialStats.total_pending_delivery)}</p>
                  </button>
                  <button
                    onClick={() => setShowSellerStats(!showSellerStats)}
                    className="rounded-lg border bg-white p-3 text-left hover:bg-rose-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-rose-600 uppercase">Pend. cobro</p>
                      <ChevronDown className={`h-4 w-4 text-rose-400 transition-transform ${showSellerStats ? 'rotate-180' : ''}`} />
                    </div>
                    <p className="text-xl font-bold text-rose-700 mt-1">{formatPrice(financialStats.total_pending_payment)}</p>
                  </button>
                </div>
              </div>
            </div>

            {projections && (
              <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-indigo-700 uppercase tracking-wide">Proyecciones Ventas + Stock</h3>
                <div className="mt-3 grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {projections.scenarios.map((scenario) => (
                    <div key={scenario.key} className="rounded-lg border bg-white p-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{scenario.label}</span>
                        <span className="font-semibold text-gray-900">{formatPrice(scenario.total)}</span>
                      </div>
                      <div className={`text-xs mt-1 ${scenario.diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        Diferencia vs inversion: {formatPrice(scenario.diff)} ({formatPct(scenario.pct)})
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats by Seller - Collapsible */}
            {financialStats.by_seller && showSellerStats && (
              <div className="rounded-xl border bg-gradient-to-br from-gray-50 to-white p-4 shadow-inner animate-in slide-in-from-top-2 duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Detalle por vendedor
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(financialStats.by_seller).map(([seller, stats]) => (
                    <div key={seller} className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-sm">
                          {seller[0]}
                        </div>
                        <span className="font-semibold text-gray-900">{seller}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-600 flex items-center gap-1.5">
                            <CreditCard className="h-3.5 w-3.5" />
                            Cobrado
                          </span>
                          <span className="font-semibold text-emerald-700">{formatPrice(stats.collected)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-amber-600 flex items-center gap-1.5">
                            <Truck className="h-3.5 w-3.5" />
                            Pend. Entrega
                          </span>
                          <span className="font-semibold text-amber-700">{formatPrice(stats.pending_delivery)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-rose-600 flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            Pend. Cobro
                          </span>
                          <span className="font-semibold text-rose-700">{formatPrice(stats.pending_payment)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Stats by Payer - Collapsible */}
            {purchasesByPayer && showPayerStats && (
              <div className="rounded-xl border bg-gradient-to-br from-slate-50 to-white p-4 shadow-inner animate-in slide-in-from-top-2 duration-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Detalle por pagador (compras)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {purchasesByPayer.by_payer.map((item) => (
                    <div key={item.payer} className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                          item.payer === 'Facu' ? 'bg-gradient-to-br from-blue-400 to-blue-600' : 'bg-gradient-to-br from-green-400 to-green-600'
                        }`}>
                          {item.payer[0]}
                        </div>
                        <span className="font-semibold text-gray-900">{item.payer}</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">Total pagado</span>
                          <span className="font-semibold text-gray-900">{formatPrice(item.total_amount)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-500 text-xs">Pagos registrados</span>
                          <span className="text-gray-700">{item.payment_count}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {purchasesByPayer.without_payment > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-bold text-sm">
                          ?
                        </div>
                        <span className="font-semibold text-amber-900">Sin asignar</span>
                      </div>
                      <div className="text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-amber-700">Compras pendientes de pago</span>
                          <span className="font-semibold text-amber-900">{formatPrice(purchasesByPayer.without_payment)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stock by Category */}
      {stockByCategory && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Boxes className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Stock por categoría
              </h2>
            </div>
            <p className="text-sm text-gray-500">
              Valorizado a precio origen.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div className="rounded-lg border p-4">
                <p className="text-xs text-gray-500 uppercase">Unidades en stock</p>
                <p className="text-2xl font-bold text-gray-900">{stockByCategory.total_qty}</p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-gray-500 uppercase">Valorizado total</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(stockByCategory.total_value)}</p>
              </div>
            </div>

            {stockByCategory.items.length === 0 ? (
              <div className="text-center text-sm text-gray-500 py-6">
                No hay stock asociado a productos.
              </div>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Categoría
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Stock
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Valorizado
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stockByCategory.items.map((item) => (
                      <tr key={item.category} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {item.category}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {item.stock_qty}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">
                          {formatPrice(item.stock_value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
