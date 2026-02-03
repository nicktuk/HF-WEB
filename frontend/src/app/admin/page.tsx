'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Package, Eye, EyeOff, TrendingUp, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useSourceWebsites } from '@/hooks/useProducts';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface SourceCategoryStat {
  source_id: number;
  source_name: string;
  category: string;
  enabled_count: number;
  total_count: number;
}

interface StatsResponse {
  sources: { id: number; name: string }[];
  categories: string[];
  stats: SourceCategoryStat[];
  chart_data: Record<string, string | number>[];
}

// Colors for categories in chart
const CATEGORY_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
];

export default function AdminDashboard() {
  const apiKey = useApiKey();

  // Get recent products (last 20 by created_at)
  const { data: recentProducts } = useAdminProducts(apiKey || '', { limit: 20 });
  // Get counts for enabled/disabled
  const { data: enabledData } = useAdminProducts(apiKey || '', { limit: 1, enabled: true });
  const { data: disabledData } = useAdminProducts(apiKey || '', { limit: 1, enabled: false });
  const { data: sourceWebsites } = useSourceWebsites(apiKey || '');

  // Get stats by source and category
  const { data: statsData } = useQuery<StatsResponse>({
    queryKey: ['admin-stats-by-source-category'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/stats/by-source-category`,
        {
          headers: { 'X-Admin-API-Key': apiKey || '' },
        }
      );
      if (!response.ok) throw new Error('Error fetching stats');
      return response.json();
    },
    enabled: !!apiKey,
  });

  const enabledCount = enabledData?.total || 0;
  const disabledCount = disabledData?.total || 0;
  const totalProducts = enabledCount + disabledCount;

  const productsWithMarketData = recentProducts?.items.filter(
    (p) => p.market_avg_price
  ).length || 0;

  // Group stats by source for the table
  const statsBySource = useMemo(() => {
    if (!statsData) return [];

    const grouped: Record<string, { name: string; categories: Record<string, { enabled: number; total: number }> }> = {};

    for (const stat of statsData.stats) {
      if (!grouped[stat.source_name]) {
        grouped[stat.source_name] = { name: stat.source_name, categories: {} };
      }
      grouped[stat.source_name].categories[stat.category] = {
        enabled: stat.enabled_count,
        total: stat.total_count,
      };
    }

    return Object.values(grouped);
  }, [statsData]);

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
                <p className="text-sm text-gray-600">Con datos de mercado</p>
                <p className="text-2xl font-bold text-gray-900">{productsWithMarketData}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats by Source and Category */}
      {statsData && statsData.categories.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              Productos por Web de Origen y Categoria
            </h2>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-gray-600 sticky left-0 bg-white">
                      Web Origen
                    </th>
                    {statsData.categories.map((cat) => (
                      <th key={cat} className="text-center py-2 px-3 font-medium text-gray-600 min-w-[100px]">
                        {cat}
                      </th>
                    ))}
                    <th className="text-center py-2 px-3 font-medium text-gray-600">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statsBySource.map((source) => {
                    const totalEnabled = Object.values(source.categories).reduce((sum, c) => sum + c.enabled, 0);
                    const totalAll = Object.values(source.categories).reduce((sum, c) => sum + c.total, 0);

                    return (
                      <tr key={source.name} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium text-gray-900 sticky left-0 bg-white">
                          {source.name}
                        </td>
                        {statsData.categories.map((cat) => {
                          const catStats = source.categories[cat];
                          return (
                            <td key={cat} className="py-2 px-3 text-center">
                              {catStats ? (
                                <span className={catStats.enabled > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>
                                  {catStats.enabled}/{catStats.total}
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-center font-semibold text-gray-900">
                          {totalEnabled}/{totalAll}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stacked Bar Chart */}
      {statsData && statsData.chart_data.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              Productos Activados por Web de Origen
            </h2>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={statsData.chart_data}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="source" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {statsData.categories.map((category, index) => (
                    <Bar
                      key={category}
                      dataKey={category}
                      stackId="a"
                      fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                      name={category}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

        {/* Recent Products */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">
              Ultimos 20 Productos del Scraping
            </h2>
          </CardHeader>
          <CardContent>
            {recentProducts?.items && recentProducts.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-gray-600">Producto</th>
                      <th className="text-left py-2 font-medium text-gray-600">Categoria</th>
                      <th className="text-right py-2 font-medium text-gray-600">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentProducts.items.map((product) => (
                      <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-2">
                          <Link
                            href={`/admin/productos/${product.id}`}
                            className="font-medium text-gray-900 hover:text-primary-600 line-clamp-1"
                          >
                            {product.custom_name || product.original_name}
                          </Link>
                        </td>
                        <td className="py-2 text-gray-600">
                          {product.category || <span className="text-gray-400">-</span>}
                        </td>
                        <td className="py-2 text-right">
                          <Badge variant={product.enabled ? 'success' : 'default'}>
                            {product.enabled ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No hay productos
              </p>
            )}
            <Link
              href="/admin/productos"
              className="block mt-4 text-center text-sm text-primary-600 hover:text-primary-700"
            >
              Ver todos los productos <ChevronRight className="inline h-4 w-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
