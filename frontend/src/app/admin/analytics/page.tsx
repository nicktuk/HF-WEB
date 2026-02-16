'use client';

import { useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LineChart, MousePointerClick, MessageCircle, Search, Users } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface AnalyticsSummary {
  window_days: number;
  from_date: string;
  totals: {
    sessions: number;
    page_views: number;
    searches: number;
    product_clicks: number;
    whatsapp_clicks: number;
    product_ctr: number;
    whatsapp_from_product_ctr: number;
  };
  top_searches: Array<{ query: string; count: number }>;
  top_categories: Array<{ category: string; count: number }>;
  top_products: Array<{ product_id: number | null; product_slug: string; count: number }>;
  daily: Array<{
    date: string | null;
    page_views: number;
    searches: number;
    product_clicks: number;
    whatsapp_clicks: number;
  }>;
}

export default function AnalyticsPage() {
  const apiKey = useApiKey();
  const [days, setDays] = useState(7);

  const { data, isLoading, isError, isFetching, refetch } = useQuery<AnalyticsSummary>({
    queryKey: ['admin-public-analytics', days],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/stats/public-analytics?days=${days}`,
        { headers: { 'X-Admin-API-Key': apiKey || '' } }
      );
      if (!response.ok) {
        throw new Error('No se pudo cargar la analitica');
      }
      return response.json();
    },
    enabled: !!apiKey,
  });

  const rangeButtons = [7, 14, 30];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analitica Publica</h1>
          <p className="text-gray-600">Navegacion del frontend de usuario final</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              isFetching
                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                : 'bg-gray-800 text-white hover:bg-gray-700'
            }`}
          >
            {isFetching ? 'Actualizando...' : 'Actualizar'}
          </button>
          {rangeButtons.map((value) => (
            <button
              key={value}
              onClick={() => setDays(value)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                days === value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {value} dias
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="p-6 text-gray-600">Cargando analitica...</CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <CardContent className="p-6 text-red-600">No se pudo cargar la analitica.</CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard title="Sesiones" value={data.totals.sessions} icon={Users} color="blue" />
            <MetricCard title="Page Views" value={data.totals.page_views} icon={LineChart} color="indigo" />
            <MetricCard title="Busquedas" value={data.totals.searches} icon={Search} color="amber" />
            <MetricCard title="Clicks Producto" value={data.totals.product_clicks} icon={MousePointerClick} color="violet" />
            <MetricCard title="Clicks WhatsApp" value={data.totals.whatsapp_clicks} icon={MessageCircle} color="green" />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Embudo</h2>
                <p className="text-sm text-gray-500">Desde {data.from_date} (ultimos {data.window_days} dias)</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <FunnelRow
                  label="CTR a producto (click producto / page view)"
                  value={`${data.totals.product_ctr}%`}
                />
                <FunnelRow
                  label="CTR a WhatsApp (click WhatsApp / click producto)"
                  value={`${data.totals.whatsapp_from_product_ctr}%`}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Top Busquedas</h2>
              </CardHeader>
              <CardContent>
                <SimpleTable
                  rows={data.top_searches.map((item) => [item.query, item.count.toString()])}
                  emptyLabel="Sin busquedas registradas"
                  leftHeader="Busqueda"
                  rightHeader="Eventos"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Top Categorias</h2>
              </CardHeader>
              <CardContent>
                <SimpleTable
                  rows={data.top_categories.map((item) => [item.category, item.count.toString()])}
                  emptyLabel="Sin clicks de categoria"
                  leftHeader="Categoria"
                  rightHeader="Eventos"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">Top Productos</h2>
              </CardHeader>
              <CardContent>
                <SimpleTable
                  rows={data.top_products.map((item) => [item.product_slug, item.count.toString()])}
                  emptyLabel="Sin clicks de producto"
                  leftHeader="Slug"
                  rightHeader="Eventos"
                />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold text-gray-900">Tendencia Diaria</h2>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Fecha</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Page Views</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Busquedas</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Clicks Producto</th>
                      <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">Clicks WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {data.daily.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-4 text-center text-sm text-gray-500">
                          Sin datos para este rango
                        </td>
                      </tr>
                    ) : (
                      data.daily.map((row) => (
                        <tr key={row.date || 'no-date'} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-800">{row.date || '-'}</td>
                          <td className="px-3 py-2 text-right text-sm text-gray-800">{row.page_views}</td>
                          <td className="px-3 py-2 text-right text-sm text-gray-800">{row.searches}</td>
                          <td className="px-3 py-2 text-right text-sm text-gray-800">{row.product_clicks}</td>
                          <td className="px-3 py-2 text-right text-sm text-gray-800">{row.whatsapp_clicks}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function FunnelRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
  color: 'blue' | 'indigo' | 'amber' | 'violet' | 'green';
}) {
  const colorMap: Record<typeof color, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
    indigo: { bg: 'bg-indigo-100', text: 'text-indigo-700' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
    violet: { bg: 'bg-violet-100', text: 'text-violet-700' },
    green: { bg: 'bg-green-100', text: 'text-green-700' },
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${colorMap[color].bg}`}>
            <Icon className={`h-5 w-5 ${colorMap[color].text}`} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SimpleTable({
  rows,
  emptyLabel,
  leftHeader,
  rightHeader,
}: {
  rows: string[][];
  emptyLabel: string;
  leftHeader: string;
  rightHeader: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">{leftHeader}</th>
            <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">{rightHeader}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={2} className="px-3 py-4 text-center text-sm text-gray-500">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.join('|')} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-sm text-gray-800">{row[0]}</td>
                <td className="px-3 py-2 text-right text-sm font-medium text-gray-900">{row[1]}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
