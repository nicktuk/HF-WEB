'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useApiKey } from '@/hooks/useAuth';
import { useStockPurchases, useDeposits, useUpdateStockPurchase } from '@/hooks/useProducts';
import { Input } from '@/components/ui/input';
import { formatDate, formatPrice } from '@/lib/utils';

export default function StockLotesPage() {
  const apiKey = useApiKey() || '';
  const { data: purchases } = useStockPurchases(apiKey, undefined, false);
  const { data: deposits } = useDeposits(apiKey);
  const updatePurchase = useUpdateStockPurchase(apiKey);
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? (purchases || []).filter(
          (p) =>
            (p.product_name || p.description || '').toLowerCase().includes(q) ||
            (p.deposit_name || '').toLowerCase().includes(q),
        )
      : purchases || [];
  }, [purchases, search]);

  const handleDepositChange = async (purchaseId: number, productId: number | null, depositId: number) => {
    setUpdatingId(purchaseId);
    try {
      await updatePurchase.mutateAsync({ purchaseId, productId, depositId });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lotes de stock</h1>
        <p className="text-gray-600">Asigná el depósito a cada lote de stock comprado.</p>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
          <Input
            type="search"
            placeholder="Buscar producto o depósito..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <span className="text-sm text-gray-500">{filtered.length} lotes</span>
        </div>

        <div className="overflow-x-auto">
          {!purchases ? (
            <div className="p-4 text-sm text-gray-500">Cargando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">Sin resultados.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fecha</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cant.</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Salida</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Disponible</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Depósito</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((p) => {
                  const available = p.quantity - p.out_quantity;
                  const isUpdating = updatingId === p.id;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        {p.product_id ? (
                          <Link
                            href={`/admin/productos/${p.product_id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {p.product_name || `Producto #${p.product_id}`}
                          </Link>
                        ) : (
                          <span className="text-gray-500">{p.description || 'Sin nombre'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(p.purchase_date)}</td>
                      <td className="px-4 py-3 text-right">{p.quantity}</td>
                      <td className="px-4 py-3 text-right text-gray-500">{p.out_quantity}</td>
                      <td className={`px-4 py-3 text-right font-medium ${available < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {available}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={p.deposit_id ?? ''}
                          onChange={(e) =>
                            handleDepositChange(p.id, p.product_id, Number(e.target.value))
                          }
                          disabled={isUpdating || !deposits?.length}
                          className="text-sm border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                        >
                          <option value="">Sin depósito</option>
                          {(deposits || []).map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
