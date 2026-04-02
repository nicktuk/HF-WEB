'use client';

import { useEffect, useState, useMemo } from 'react';
import { Trophy, RefreshCw, TrendingUp, ShoppingBag, Package, Search, X, ChevronDown, ChevronRight, Check } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatPrice } from '@/lib/utils';
import type { CustomerRankingItem, Sale } from '@/types';

type SortKey = 'total_amount' | 'purchase_count' | 'product_count';

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(value);

// ─── Progress helpers (mismo criterio que ventas) ────────────────────────────

const getStatus = (total: number, amount: number): 'none' | 'partial' | 'full' => {
  if (total <= 0 || amount <= 0) return 'none';
  if (amount >= total - 0.01) return 'full';
  return 'partial';
};

function ProgressDot({ status }: { status: 'none' | 'partial' | 'full' }) {
  if (status === 'full')
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white"><Check className="h-3 w-3" /></span>;
  if (status === 'partial')
    return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-white"><Check className="h-3 w-3" /></span>;
  return <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white" />;
}

// ─── Sale card (expandible) ───────────────────────────────────────────────────

function SaleCard({ sale }: { sale: Sale }) {
  const [open, setOpen] = useState(false);
  const total = Number(sale.total_amount || 0);
  const deliveredStatus = getStatus(total, Number(sale.delivered_amount || 0));
  const paidStatus = getStatus(total, Number(sale.paid_amount || 0));

  return (
    <div className="rounded-lg border bg-white shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-3 min-w-0">
          {open ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
          <div className="min-w-0">
            <span className="text-sm font-medium text-gray-900">Venta #{sale.id}</span>
            {sale.notes && <p className="text-xs text-gray-500 truncate">{sale.notes}</p>}
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 ml-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <ProgressDot status={deliveredStatus} />
            Entrega
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <ProgressDot status={paidStatus} />
            Pago
          </div>
          <span className="text-sm font-semibold text-green-700">{formatCurrency(total)}</span>
        </div>
      </button>

      {open && (
        <div className="border-t">
          {sale.installments && (
            <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
              Cuotas: {sale.installments} · Vendedor: {sale.seller}
            </p>
          )}
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cant.</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Entregado</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Cobrado</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">P. Unit.</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sale.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-900">{item.product_name || '—'}</td>
                  <td className="px-4 py-2 text-center text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex justify-center">
                      <ProgressDot status={item.delivered ? 'full' : (item.delivered_quantity > 0 ? 'partial' : 'none')} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex justify-center">
                      <ProgressDot status={item.paid ? 'full' : 'none'} />
                    </div>
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700">{formatPrice(Number(item.unit_price))}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{formatPrice(Number(item.total_price))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-6 border-t bg-gray-50 px-4 py-2 text-xs text-gray-600">
            <span>Entregado: <strong>{formatCurrency(Number(sale.delivered_amount))}</strong></span>
            <span>Cobrado: <strong>{formatCurrency(Number(sale.paid_amount))}</strong></span>
            <span>Total: <strong className="text-gray-900">{formatCurrency(total)}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Customer drawer ──────────────────────────────────────────────────────────

function CustomerDrawer({
  customer,
  apiKey,
  onClose,
}: {
  customer: CustomerRankingItem;
  apiKey: string;
  onClose: () => void;
}) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApi.listSales(apiKey, 200, customer.customer_name)
      .then(setSales)
      .finally(() => setLoading(false));
  }, [customer.customer_name, apiKey]);

  // filter to exact customer match (the search is partial, so narrow it down)
  const exactSales = useMemo(
    () => sales.filter((s) => (s.customer_name ?? 'Sin nombre') === customer.customer_name),
    [sales, customer.customer_name]
  );

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-gray-100 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-white px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{customer.customer_name}</h2>
            <p className="text-sm text-gray-500">
              {customer.purchase_count} ventas · {customer.product_count} productos · {formatCurrency(customer.total_amount)}
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">Cargando ventas...</div>
          ) : exactSales.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-400">Sin ventas encontradas</div>
          ) : (
            exactSales.map((sale) => <SaleCard key={sale.id} sale={sale} />)
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ClientesRankingPage() {
  const apiKey = useAuth((s) => s.apiKey) ?? '';
  const [data, setData] = useState<CustomerRankingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortKey>('total_amount');
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRankingItem | null>(null);

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

  const sorted = useMemo(() => {
    const filtered = search.trim()
      ? data.filter((r) => r.customer_name.toLowerCase().includes(search.trim().toLowerCase()))
      : data;
    return [...filtered].sort((a, b) => b[sortBy] - a[sortBy]);
  }, [data, sortBy, search]);

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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar cliente..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm shadow-sm focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow ring-1 ring-gray-200">
        {loading && data.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Cargando...</div>
        ) : sorted.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            {search ? `Sin resultados para "${search}"` : 'Sin datos de ventas'}
          </div>
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
                <tr
                  key={row.customer_name}
                  onClick={() => setSelectedCustomer(row)}
                  className={`cursor-pointer transition-colors ${i < 3 ? 'bg-yellow-50/40 hover:bg-yellow-100/60' : 'hover:bg-blue-50'}`}
                >
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

      {/* Customer detail drawer */}
      {selectedCustomer && (
        <CustomerDrawer
          customer={selectedCustomer}
          apiKey={apiKey}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
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
