'use client';

import { useEffect, useState, useMemo } from 'react';
import { Trophy, RefreshCw, TrendingUp, ShoppingBag, Package } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import type { CustomerRankingItem } from '@/types';

type SortKey = 'total_amount' | 'purchase_count' | 'product_count';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(value);

export default function ClientesRankingPage() {
  const apiKey = useAuth((s) => s.apiKey) ?? '';
  const [data, setData] = useState<CustomerRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('total_amount');

  const load = async () => {
    setLoading(true);
    try {
      const result = await adminApi.getCustomerRanking(apiKey);
      setData(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sorted = useMemo(() =>
    [...data].sort((a, b) => b[sortBy] - a[sortBy]),
    [data, sortBy]
  );

  const totals = useMemo(() => ({
    customers: data.length,
    purchases: data.reduce((s, r) => s + r.purchase_count, 0),
    products: data.reduce((s, r) => s + r.product_count, 0),
    amount: data.reduce((s, r) => s + r.total_amount, 0),
  }), [data]);

  const headerClass = (key: SortKey) =>
    `cursor-pointer select-none px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide transition-colors ${
      sortBy === key ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'
    }`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="h-7 w-7 text-yellow-500" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ranking de Clientes</h1>
            <p className="text-sm text-gray-500">Clientes ordenados por ventas acumuladas</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard icon={<Trophy className="h-5 w-5 text-yellow-500" />} label="Clientes únicos" value={String(totals.customers)} />
        <SummaryCard icon={<ShoppingBag className="h-5 w-5 text-blue-500" />} label="Compras totales" value={String(totals.purchases)} />
        <SummaryCard icon={<Package className="h-5 w-5 text-purple-500" />} label="Productos vendidos" value={String(totals.products)} />
        <SummaryCard icon={<TrendingUp className="h-5 w-5 text-green-500" />} label="Total facturado" value={formatCurrency(totals.amount)} />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow ring-1 ring-gray-200">
        {loading && data.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Sin datos de ventas</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 w-10">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</th>
                <th className={headerClass('purchase_count')} onClick={() => setSortBy('purchase_count')}>
                  Compras {sortBy === 'purchase_count' && '▼'}
                </th>
                <th className={headerClass('product_count')} onClick={() => setSortBy('product_count')}>
                  Productos {sortBy === 'product_count' && '▼'}
                </th>
                <th className={headerClass('total_amount')} onClick={() => setSortBy('total_amount')}>
                  Total {sortBy === 'total_amount' && '▼'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((row, i) => (
                <tr key={row.customer_name} className={i < 3 ? 'bg-yellow-50/40' : 'hover:bg-gray-50'}>
                  <td className="px-4 py-3 font-semibold text-gray-400 text-center">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{row.customer_name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.purchase_count}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{row.product_count}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(row.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow ring-1 ring-gray-200">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
