'use client';

import { useMemo, useState, Fragment } from 'react';
import Link from 'next/link';
import { FileDown, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useApiKey, useIsSuperadmin } from '@/hooks/useAuth';
import { useStockPurchases, useStockSummary } from '@/hooks/useProducts';
import { downloadExcel } from '@/lib/excel';
import { formatPrice } from '@/lib/utils';

export default function StockResumenPage() {
  const apiKey = useApiKey() || '';
  const isSuperadmin = useIsSuperadmin();
  const [search, setSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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

  // Aggregate per product + breakdown per deposit
  const rows = useMemo(() => {
    const byProduct = (stockPurchases || []).reduce(
      (acc, item) => {
        const key = item.product_id ?? -item.id;
        const name = item.product_name || item.description || `Producto #${item.product_id || 'N/A'}`;
        if (!acc[key]) {
          acc[key] = { key, name, purchased: 0, out: 0, deposits: {} };
        }
        acc[key].purchased += Number(item.quantity || 0);
        acc[key].out += Number(item.out_quantity || 0);

        // Deposit breakdown
        const depositKey = item.deposit_id ?? 0;
        const depositLabel = item.deposit_name || 'Sin depósito';
        if (!acc[key].deposits[depositKey]) {
          acc[key].deposits[depositKey] = { name: depositLabel, quantity: 0, out: 0 };
        }
        acc[key].deposits[depositKey].quantity += Number(item.quantity || 0);
        acc[key].deposits[depositKey].out += Number(item.out_quantity || 0);

        return acc;
      },
      {} as Record<
        number,
        {
          key: number;
          name: string;
          purchased: number;
          out: number;
          deposits: Record<number, { name: string; quantity: number; out: number }>;
        }
      >,
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

  const toggleRow = (key: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const hasMultipleDeposits = (row: (typeof rows)[0]) => Object.keys(row.deposits).length > 1;

  const handleExportExcel = () => {
    if (!filteredRows.length) return;
    const excelRows = filteredRows.map((row) => {
      const summary = row.key > 0 ? summaryMap.get(row.key) : undefined;
      const reservedQty = Number(summary?.reserved_qty || 0);
      const diff = row.purchased - row.out - reservedQty;
      const depositBreakdown = Object.values(row.deposits)
        .map((d) => `${d.name}: ${d.quantity - d.out}`)
        .join(' | ');
      const base = [row.name, row.purchased, row.out, reservedQty, diff, depositBreakdown];
      if (isSuperadmin) {
        const originalPrice = Number(summary?.original_price || 0);
        const reservedSoldValue = Number(summary?.reserved_sale_value || 0);
        base.push(originalPrice, reservedQty * originalPrice, reservedSoldValue);
      }
      return base;
    });

    const columns: import('@/lib/excel').ExcelColumn[] = [
      { header: 'Producto', type: 'string', width: 42 },
      { header: 'Cantidad comprada', type: 'integer', width: 18 },
      { header: 'Cantidad salida', type: 'integer', width: 16 },
      { header: 'Reservado', type: 'integer', width: 12 },
      { header: 'Stock', type: 'integer', width: 10 },
      { header: 'Por depósito', type: 'string', width: 30 },
      ...(isSuperadmin ? [
        { header: 'Precio costo', type: 'number' as const, width: 14 },
        { header: 'Reservado costo', type: 'number' as const, width: 16 },
        { header: 'Reservado vendido', type: 'number' as const, width: 18 },
      ] : []),
    ];

    downloadExcel('stock_resumen', 'Stock', columns, excelRows);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Stock</h1>
        <p className="text-gray-600">Resumen de stock por producto, incluyendo reservas y depósitos.</p>
      </div>

      <div className="bg-white rounded-lg border">
        {isSuperadmin && (
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
        )}

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
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={!filteredRows.length}>
              <FileDown className="h-4 w-4 mr-1" />
              Exportar Excel
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
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-6"></th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Depósitos</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Comprado</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Salida</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Reservado</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRows.map((row) => {
                  const summary = row.key > 0 ? summaryMap.get(row.key) : undefined;
                  const reservedQty = Number(summary?.reserved_qty || 0);
                  const diff = row.purchased - row.out - reservedQty;
                  const depositEntries = Object.values(row.deposits);
                  const isExpanded = expandedRows.has(row.key);
                  const multiDeposit = hasMultipleDeposits(row);

                  return (
                    <Fragment key={row.key}>
                      <tr className="hover:bg-gray-50">
                        <td className="px-2 py-3 text-gray-400">
                          {multiDeposit && (
                            <button onClick={() => toggleRow(row.key)} className="p-0.5 hover:text-gray-700">
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </td>
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
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {depositEntries.map((d, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium"
                              >
                                {d.name}
                                <span className="font-bold">{d.quantity - d.out}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">{row.purchased}</td>
                        <td className="px-4 py-3 text-right">{row.out}</td>
                        <td className="px-4 py-3 text-right">{reservedQty}</td>
                        <td className={`px-4 py-3 text-right font-medium ${diff < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                          {diff}
                        </td>
                      </tr>
                      {multiDeposit && isExpanded && depositEntries.map((d, i) => (
                        <tr key={`${row.key}-dep-${i}`} className="bg-blue-50/40">
                          <td className="px-2 py-2"></td>
                          <td className="px-4 py-2 text-xs text-gray-500 pl-8">↳</td>
                          <td className="px-4 py-2 text-xs font-medium text-blue-800">{d.name}</td>
                          <td className="px-4 py-2 text-right text-xs text-gray-600">{d.quantity}</td>
                          <td className="px-4 py-2 text-right text-xs text-gray-600">{d.out}</td>
                          <td className="px-4 py-2 text-right text-xs text-gray-600">—</td>
                          <td className="px-4 py-2 text-right text-xs font-medium text-gray-800">{d.quantity - d.out}</td>
                        </tr>
                      ))}
                    </Fragment>
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
