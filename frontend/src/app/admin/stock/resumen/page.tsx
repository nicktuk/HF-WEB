'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey } from '@/hooks/useAuth';
import { useStockPurchases, useStockSummary } from '@/hooks/useProducts';
import { downloadCsv } from '@/lib/csv';
import { formatPrice } from '@/lib/utils';

export default function StockResumenPage() {
  const apiKey = useApiKey() || '';
  const [search, setSearch] = useState('');

  const { data: stockPurchases } = useStockPurchases(apiKey, undefined, false);
  const stockProductIds = useMemo(
    () =>
      Array.from(
        new Set(
          (stockPurchases || [])
            .map((item) => item.product_id)
            .filter((id): id is number => typeof id === 'number'),
        ),
      ),
    [stockPurchases],
  );
  const { data: stockSummary } = useStockSummary(apiKey, stockProductIds);

  const rows = useMemo(() => {
    const byProduct = (stockPurchases || []).reduce(
      (acc, item) => {
        const key = item.product_id ?? -item.id;
        const name = item.product_name || item.description || `Producto #${item.product_id || 'N/A'}`;
        if (!acc[key]) {
          acc[key] = { key, name, purchased: 0, out: 0 };
        }
        acc[key].purchased += Number(item.quantity || 0);
        acc[key].out += Number(item.out_quantity || 0);
        return acc;
      },
      {} as Record<number, { key: number; name: string; purchased: number; out: number }>,
    );
    return Object.values(byProduct);
  }, [stockPurchases]);

  const summaryMap = useMemo(() => {
    const map = new Map<number, { reserved_qty: number; original_price: number; reserved_sale_value: number }>();
    (stockSummary?.items || []).forEach((item) => {
      map.set(item.product_id, {
        reserved_qty: Number(item.reserved_qty || 0),
        original_price: Number(item.original_price || 0),
        reserved_sale_value: Number(item.reserved_sale_value || 0),
      });
    });
    return map;
  }, [stockSummary]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = q ? rows.filter((row) => row.name.toLowerCase().includes(q)) : rows;
    return [...base].sort((a, b) => {
      const reservedA = Number((a.key > 0 ? summaryMap.get(a.key)?.reserved_qty : 0) || 0);
      const reservedB = Number((b.key > 0 ? summaryMap.get(b.key)?.reserved_qty : 0) || 0);
      const diffA = a.purchased - a.out - reservedA;
      const diffB = b.purchased - b.out - reservedB;
      if (diffA !== diffB) return diffB - diffA;
      return a.name.localeCompare(b.name, 'es');
    });
  }, [rows, search, summaryMap]);

  const cards = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        if (row.key <= 0) return acc;
        const summary = summaryMap.get(row.key);
        const reservedQty = Number(summary?.reserved_qty || 0);
        const originalPrice = Number(summary?.original_price || 0);
        const reservedSaleValue = Number(summary?.reserved_sale_value || 0);
        const existence = row.purchased - row.out;
        const availableNoReserved = Math.max(0, existence - reservedQty);

        acc.stockValue += availableNoReserved * originalPrice;
        acc.reservedCostValue += reservedQty * originalPrice;
        acc.reservedSoldValue += reservedSaleValue;
        return acc;
      },
      { stockValue: 0, reservedCostValue: 0, reservedSoldValue: 0 },
    );
  }, [rows, summaryMap]);

  const handleExportCsv = () => {
    if (!filteredRows.length) return;
    const csvRows = filteredRows.map((row) => {
      const summary = row.key > 0 ? summaryMap.get(row.key) : undefined;
      const reservedQty = Number(summary?.reserved_qty || 0);
      const originalPrice = Number(summary?.original_price || 0);
      const reservedSoldValue = Number(summary?.reserved_sale_value || 0);
      const diff = row.purchased - row.out - reservedQty;
      const reservedCostValue = reservedQty * originalPrice;
      return [
        row.name,
        row.purchased,
        row.out,
        reservedQty,
        diff,
        originalPrice.toFixed(2),
        reservedCostValue.toFixed(2),
        reservedSoldValue.toFixed(2),
      ];
    });
    downloadCsv(
      'stock_resumen.csv',
      [
        'Producto',
        'Cantidad comprada',
        'Cantidad salida',
        'Reservado',
        'Stock',
        'Precio costo',
        'Reservado costo',
        'Reservado vendido',
      ],
      csvRows,
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
        <p className="text-gray-600">Resumen de stock por producto, incluyendo reservas.</p>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-4 py-3 border-b bg-gray-50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-gray-500 uppercase">$ STOCK</p>
              <p className="text-xl font-semibold text-gray-900">{formatPrice(cards.stockValue)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-gray-500 uppercase">$ STOCK reservado (costo)</p>
              <p className="text-xl font-semibold text-gray-900">{formatPrice(cards.reservedCostValue)}</p>
            </div>
            <div className="rounded-lg border bg-white p-3">
              <p className="text-xs text-gray-500 uppercase">$ STOCK reservado (vendido)</p>
              <p className="text-xl font-semibold text-gray-900">{formatPrice(cards.reservedSoldValue)}</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3">
          <div className="w-full max-w-sm">
            <Input
              type="search"
              placeholder="Buscar producto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{filteredRows.length} productos</span>
            <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!filteredRows.length}>
              <FileDown className="h-4 w-4 mr-1" />
              Exportar CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {!stockPurchases ? (
            <div className="p-4 text-sm text-gray-500">Cargando stock...</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-4 text-sm text-gray-500">No hay movimientos de stock asociados a productos.</div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad comprada</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad salida</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Reservado</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRows.map((row) => {
                  const summary = row.key > 0 ? summaryMap.get(row.key) : undefined;
                  const reservedQty = Number(summary?.reserved_qty || 0);
                  const diff = row.purchased - row.out - reservedQty;
                  return (
                    <tr key={row.key} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900">
                        {row.key > 0 ? (
                          <Link
                            href={`/admin/productos/${row.key}`}
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {row.name}
                          </Link>
                        ) : (
                          row.name
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{row.purchased}</td>
                      <td className="px-4 py-3 text-right">{row.out}</td>
                      <td className="px-4 py-3 text-right">{reservedQty}</td>
                      <td className={`px-4 py-3 text-right font-medium ${diff < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {diff}
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
