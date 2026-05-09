'use client';

import { useState } from 'react';
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
  ReferenceLine,
  Cell,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';

interface MonthData {
  month: number;
  label: string;
  num_compras: number;
  items_distintos: number;
  items_totales: number;
  total_invertido: number;
  num_ventas: number;
  importe_ventas: number;
  total_gastos: number;
  balance: number;
}

const C = {
  ventas:         '#3b82f6',
  invertido:      '#f43f5e',
  gastos:         '#10b981',
  balancePos:     '#8b5cf6',
  balanceNeg:     '#f97316',
  numCompras:     '#f43f5e',
  numVentas:      '#3b82f6',
  itemsDistintos: '#10b981',
  itemsTotales:   '#f59e0b',
};

const $k = (n: number) =>
  n === 0 ? '' : `$${Math.abs(n / 1000).toFixed(0)}k`;

const $fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n);

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as MonthData | undefined;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-md p-3 text-xs space-y-1 min-w-[170px]">
      <p className="font-semibold text-zinc-700 mb-2">{label}</p>
      {payload.map((e: any) => {
        const count =
          e.dataKey === 'importe_ventas' ? row?.num_ventas
          : e.dataKey === 'total_invertido' ? row?.num_compras
          : null;
        return (
          <div key={e.dataKey} className="flex justify-between gap-4">
            <span style={{ color: e.color }} className="font-medium">
              {e.name}{count != null ? ` (×${count})` : ''}
            </span>
            <span className="text-zinc-800">{$fmt(e.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as MonthData | undefined;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-md p-3 text-xs space-y-1 min-w-[170px]">
      <p className="font-semibold text-zinc-700 mb-2">{label}</p>
      {payload.map((e: any) => {
        const amount =
          e.dataKey === 'num_ventas' ? row?.importe_ventas
          : e.dataKey === 'num_compras' ? row?.total_invertido
          : null;
        return (
          <div key={e.dataKey} className="flex justify-between gap-4">
            <span style={{ color: e.color }} className="font-medium">{e.name}</span>
            <span className="text-zinc-800">
              {e.value}
              {amount != null && amount > 0 ? ` · ${$fmt(amount)}` : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function MonthlySummaryCard({ apiKey }: { apiKey: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { data, isLoading } = useQuery<MonthData[]>({
    queryKey: ['admin-stats-monthly-summary', year],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/stats/monthly-summary?year=${year}`,
        { headers: { 'X-Admin-API-Key': apiKey } }
      );
      if (!res.ok) throw new Error('Error fetching monthly summary');
      return res.json();
    },
    enabled: !!apiKey,
  });

  const years = [currentYear - 1, currentYear];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Resumen mensual</h2>
          </div>
          <div className="flex gap-1">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  year === y
                    ? 'bg-zinc-900 text-white'
                    : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-8">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-zinc-400 text-sm">
            Cargando...
          </div>
        ) : (
          <>
            {/* Montos */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                Montos ($)
              </p>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={data}
                  margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
                  barGap={2}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={(v) => `$${Math.abs(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip content={<MoneyTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" iconSize={8} />
                  <ReferenceLine y={0} stroke="#d4d4d8" />

                  <Bar dataKey="importe_ventas" name="Ventas" fill={C.ventas} radius={[4, 4, 0, 0]} maxBarSize={26}>
                    <LabelList
                      dataKey="num_ventas"
                      position="top"
                      style={{ fontSize: 10, fontWeight: 700, fill: C.ventas }}
                      formatter={(v: number) => v > 0 ? v : ''}
                    />
                  </Bar>

                  <Bar dataKey="total_invertido" name="Invertido" fill={C.invertido} radius={[4, 4, 0, 0]} maxBarSize={26}>
                    <LabelList
                      dataKey="num_compras"
                      position="top"
                      style={{ fontSize: 10, fontWeight: 700, fill: C.invertido }}
                      formatter={(v: number) => v > 0 ? v : ''}
                    />
                  </Bar>

                  <Bar dataKey="total_gastos" name="Gastos" fill={C.gastos} radius={[4, 4, 0, 0]} maxBarSize={26} />

                  <Bar dataKey="balance" name="Balance" fill={C.balancePos} radius={[4, 4, 0, 0]} maxBarSize={26}>
                    {data?.map((entry) => (
                      <Cell
                        key={entry.month}
                        fill={entry.balance >= 0 ? C.balancePos : C.balanceNeg}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Cantidades */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                Cantidades
              </p>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart
                  data={data}
                  margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
                  barGap={2}
                  barCategoryGap="25%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#71717a' }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip content={<CountTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} iconType="circle" iconSize={8} />

                  <Bar dataKey="num_compras" name="Compras" fill={C.numCompras} radius={[4, 4, 0, 0]} maxBarSize={24}>
                    <LabelList
                      dataKey="total_invertido"
                      position="top"
                      style={{ fontSize: 9, fontWeight: 600, fill: C.numCompras }}
                      formatter={$k}
                    />
                  </Bar>

                  <Bar dataKey="num_ventas" name="Ventas" fill={C.numVentas} radius={[4, 4, 0, 0]} maxBarSize={24}>
                    <LabelList
                      dataKey="importe_ventas"
                      position="top"
                      style={{ fontSize: 9, fontWeight: 600, fill: C.numVentas }}
                      formatter={$k}
                    />
                  </Bar>

                  <Bar dataKey="items_distintos" name="Ítems distintos" fill={C.itemsDistintos} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="items_totales" name="Ítems totales" fill={C.itemsTotales} radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
