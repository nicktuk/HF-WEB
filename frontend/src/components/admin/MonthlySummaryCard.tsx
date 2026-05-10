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

const C = {
  ventas:         '#3b82f6',
  invertido:      '#f43f5e',
  gastos:         '#10b981',
  balancePos:     '#8b5cf6',
  balanceNeg:     '#f97316',
  itemsDistintos: '#10b981',
  itemsTotales:   '#f59e0b',
};

function fmtM(n: number): string {
  if (n === 0) return '';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${s}$${Math.round(abs / 1_000)}k`;
  return `${s}$${Math.round(abs)}`;
}

const $fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

// Label factories — rendered as SVG <text> inside each bar
function moneyLabel(chartData: MonthData[], countKey: keyof MonthData | null, color: string) {
  return function Label({ x, y, width, value, index }: any) {
    if (!value) return null;
    const count = countKey != null ? (chartData[index]?.[countKey] as number) : null;
    const text = count ? `${fmtM(value)} (${count})` : fmtM(value);
    return (
      <text
        x={(x ?? 0) + (width ?? 0) / 2}
        y={(y ?? 0) - 6}
        textAnchor="middle"
        fill={color}
        fontSize={10}
        fontWeight={700}
      >
        {text}
      </text>
    );
  };
}

function balanceLabelFn(chartData: MonthData[]) {
  return function Label({ x, y, width, value, index }: any) {
    if (!value) return null;
    const entry = chartData[index];
    const color = (entry?.balance ?? 0) >= 0 ? C.balancePos : C.balanceNeg;
    return (
      <text
        x={(x ?? 0) + (width ?? 0) / 2}
        y={(y ?? 0) - 6}
        textAnchor="middle"
        fill={color}
        fontSize={10}
        fontWeight={700}
      >
        {fmtM(value)}
      </text>
    );
  };
}

function countLabel(color: string) {
  return function Label({ x, y, width, value }: any) {
    if (!value) return null;
    return (
      <text
        x={(x ?? 0) + (width ?? 0) / 2}
        y={(y ?? 0) - 6}
        textAnchor="middle"
        fill={color}
        fontSize={10}
        fontWeight={700}
      >
        {value}
      </text>
    );
  };
}

function CombinedTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as MonthData;
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-md p-3 text-xs min-w-[200px] space-y-1">
      <p className="font-semibold text-zinc-700 mb-2">{row.label}</p>
      <p className="text-zinc-400 uppercase tracking-wide text-[10px]">Montos</p>
      <div className="flex justify-between gap-6">
        <span style={{ color: C.ventas }}>Ventas</span>
        <span className="text-zinc-800 font-medium">{$fmt(row.importe_ventas)} ({row.num_ventas})</span>
      </div>
      <div className="flex justify-between gap-6">
        <span style={{ color: C.invertido }}>Invertido</span>
        <span className="text-zinc-800 font-medium">{$fmt(row.total_invertido)} ({row.num_compras})</span>
      </div>
      <div className="flex justify-between gap-6">
        <span style={{ color: C.gastos }}>Gastos</span>
        <span className="text-zinc-800 font-medium">{$fmt(row.total_gastos)}</span>
      </div>
      <div className="flex justify-between gap-6">
        <span style={{ color: row.balance >= 0 ? C.balancePos : C.balanceNeg }}>Balance</span>
        <span className="text-zinc-800 font-medium">{$fmt(row.balance)}</span>
      </div>
      <p className="text-zinc-400 uppercase tracking-wide text-[10px] pt-1">Cantidades</p>
      <div className="flex justify-between gap-6">
        <span style={{ color: C.itemsDistintos }}>Ítems distintos</span>
        <span className="text-zinc-800 font-medium">{row.items_distintos}</span>
      </div>
      <div className="flex justify-between gap-6">
        <span style={{ color: C.itemsTotales }}>Ítems totales</span>
        <span className="text-zinc-800 font-medium">{row.items_totales}</span>
      </div>
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

      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-zinc-400 text-sm">Cargando...</div>
        ) : (
          <ResponsiveContainer width="100%" height={550}>
            <BarChart
              data={data}
              margin={{ top: 32, right: 48, left: 0, bottom: 0 }}
              barGap={3}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#71717a' }} axisLine={false} tickLine={false} />

              {/* Left axis — money */}
              <YAxis
                yAxisId="left"
                tickFormatter={(v) => fmtM(v) || '0'}
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                width={60}
              />

              {/* Right axis — counts */}
              <YAxis
                yAxisId="right"
                orientation="right"
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#71717a' }}
                axisLine={false}
                tickLine={false}
                width={36}
              />

              <Tooltip content={<CombinedTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} iconType="circle" iconSize={8} />
              <ReferenceLine yAxisId="left" y={0} stroke="#d4d4d8" />

              {/* Money bars */}
              <Bar
                yAxisId="left"
                dataKey="importe_ventas"
                name="Ventas $"
                fill={C.ventas}
                radius={[5, 5, 0, 0]}
                label={data ? moneyLabel(data, 'num_ventas', C.ventas) : undefined}
              />
              <Bar
                yAxisId="left"
                dataKey="total_invertido"
                name="Invertido $"
                fill={C.invertido}
                radius={[5, 5, 0, 0]}
                label={data ? moneyLabel(data, 'num_compras', C.invertido) : undefined}
              />
              <Bar
                yAxisId="left"
                dataKey="total_gastos"
                name="Gastos $"
                fill={C.gastos}
                radius={[5, 5, 0, 0]}
                label={data ? moneyLabel(data, null, C.gastos) : undefined}
              />
              <Bar
                yAxisId="left"
                dataKey="balance"
                name="Balance $"
                fill={C.balancePos}
                radius={[5, 5, 0, 0]}
                label={data ? balanceLabelFn(data) : undefined}
              >
                {data?.map((entry) => (
                  <Cell
                    key={entry.month}
                    fill={entry.balance >= 0 ? C.balancePos : C.balanceNeg}
                  />
                ))}
              </Bar>

              {/* Count bars */}
              <Bar
                yAxisId="right"
                dataKey="items_distintos"
                name="Ítems distintos"
                fill={C.itemsDistintos}
                radius={[5, 5, 0, 0]}
                label={data ? countLabel(C.itemsDistintos) : undefined}
              />
              <Bar
                yAxisId="right"
                dataKey="items_totales"
                name="Ítems totales"
                fill={C.itemsTotales}
                radius={[5, 5, 0, 0]}
                label={data ? countLabel(C.itemsTotales) : undefined}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
