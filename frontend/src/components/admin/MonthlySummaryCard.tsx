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

const COLORS = {
  ventas:        '#93c5fd',
  invertido:     '#fda4af',
  gastos:        '#86efac',
  balancePos:    '#c4b5fd',
  balanceNeg:    '#f9a8d4',
  numCompras:    '#fda4af',
  numVentas:     '#93c5fd',
  itemsDistintos:'#86efac',
  itemsTotales:  '#fde68a',
};

const $ = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
  }).format(n);

function MoneyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-md p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-zinc-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium text-zinc-800">{$(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-md p-3 text-xs space-y-1 min-w-[160px]">
      <p className="font-semibold text-zinc-700 mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium text-zinc-800">{entry.value}</span>
        </div>
      ))}
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
            {/* — Montos — */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                Montos ($)
              </p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="25%">
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
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <ReferenceLine y={0} stroke="#d4d4d8" />
                  <Bar dataKey="importe_ventas" name="Ventas" fill={COLORS.ventas} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="total_invertido" name="Invertido" fill={COLORS.invertido} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="total_gastos" name="Gastos" fill={COLORS.gastos} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="balance" name="Balance" radius={[4, 4, 0, 0]} maxBarSize={28}>
                    {data?.map((entry) => (
                      <Cell
                        key={entry.month}
                        fill={entry.balance >= 0 ? COLORS.balancePos : COLORS.balanceNeg}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* — Cantidades — */}
            <div>
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
                Cantidades
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2} barCategoryGap="25%">
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
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <Bar dataKey="num_compras" name="Compras" fill={COLORS.numCompras} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="num_ventas" name="Ventas" fill={COLORS.numVentas} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="items_distintos" name="Ítems distintos" fill={COLORS.itemsDistintos} radius={[4, 4, 0, 0]} maxBarSize={24} />
                  <Bar dataKey="items_totales" name="Ítems totales" fill={COLORS.itemsTotales} radius={[4, 4, 0, 0]} maxBarSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
