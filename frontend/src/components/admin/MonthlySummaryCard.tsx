'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
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
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${s}$${Math.round(abs / 1_000)}k`;
  return `${s}$${Math.round(abs)}`;
}

const $fmt = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(n);

function annualTotals(data: MonthData[]): MonthData {
  return data.reduce(
    (acc, m) => ({
      ...acc,
      num_compras:     acc.num_compras + m.num_compras,
      items_distintos: acc.items_distintos + m.items_distintos,
      items_totales:   acc.items_totales + m.items_totales,
      total_invertido: acc.total_invertido + m.total_invertido,
      num_ventas:      acc.num_ventas + m.num_ventas,
      importe_ventas:  acc.importe_ventas + m.importe_ventas,
      total_gastos:    acc.total_gastos + m.total_gastos,
      balance:         acc.balance + m.balance,
    }),
    { month: 0, label: 'Año', num_compras: 0, items_distintos: 0, items_totales: 0, total_invertido: 0, num_ventas: 0, importe_ventas: 0, total_gastos: 0, balance: 0 }
  );
}

interface KPIItemProps { label: string; value: string; sub?: string; color: string; }
function KPIItem({ label, value, sub, color }: KPIItemProps) {
  return (
    <div className="rounded-xl bg-white border border-zinc-100 px-4 py-3 space-y-1 shadow-sm min-w-0">
      <p className="text-xs text-zinc-400 font-medium truncate">{label}</p>
      <p className="text-xl font-extrabold tabular-nums leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 leading-none">{sub}</p>}
    </div>
  );
}

function KPIPanel({ entry, heading }: { entry: MonthData; heading: string }) {
  const balColor = entry.balance >= 0 ? C.balancePos : C.balanceNeg;
  return (
    <div className="mb-6">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">{heading}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        <KPIItem label="Ventas"          value={fmtM(entry.importe_ventas)} sub={`${entry.num_ventas} operaciones`} color={C.ventas} />
        <KPIItem label="Invertido"       value={fmtM(entry.total_invertido)} sub={`${entry.num_compras} compras`}   color={C.invertido} />
        <KPIItem label="Gastos"          value={fmtM(entry.total_gastos)}                                           color={C.gastos} />
        <KPIItem label="Balance"         value={fmtM(entry.balance)}                                                color={balColor} />
        <KPIItem label="Ítems distintos" value={String(entry.items_distintos)}                                      color={C.itemsDistintos} />
        <KPIItem label="Ítems totales"   value={String(entry.items_totales)}                                        color={C.itemsTotales} />
      </div>
    </div>
  );
}

export function MonthlySummaryCard({ apiKey }: { apiKey: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [activeMonth, setActiveMonth] = useState<MonthData | null>(null);

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

  const totals = useMemo(() => data ? annualTotals(data) : null, [data]);
  const displayed = activeMonth ?? totals;
  const heading = activeMonth ? activeMonth.label + ' ' + year : 'Total ' + year;

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
                  year === y ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
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
          <>
            {displayed && <KPIPanel entry={displayed} heading={heading} />}

            <ResponsiveContainer width="100%" height={520}>
              <BarChart
                data={data}
                margin={{ top: 8, right: 48, left: 0, bottom: 0 }}
                barGap={3}
                barCategoryGap="22%"
                onMouseMove={(state: any) => {
                  if (state?.isTooltipActive && state.activePayload?.[0]) {
                    setActiveMonth(state.activePayload[0].payload);
                  }
                }}
                onMouseLeave={() => setActiveMonth(null)}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 13, fill: '#52525b', fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />

                {/* Left axis — money */}
                <YAxis
                  yAxisId="left"
                  tickFormatter={fmtM}
                  tick={{ fontSize: 12, fill: '#71717a' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />

                {/* Right axis — counts */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  allowDecimals={false}
                  tick={{ fontSize: 12, fill: '#71717a' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />

                {/* Cursor highlight only — no popup */}
                <Tooltip
                  content={() => null}
                  cursor={{ fill: 'rgba(0,0,0,0.04)', rx: 6 }}
                />

                <Legend
                  wrapperStyle={{ fontSize: 13, paddingTop: 20 }}
                  iconType="circle"
                  iconSize={9}
                />
                <ReferenceLine yAxisId="left" y={0} stroke="#d4d4d8" />

                {/* Money bars */}
                <Bar yAxisId="left" dataKey="importe_ventas"  name="Ventas $"   fill={C.ventas}    radius={[5,5,0,0]} />
                <Bar yAxisId="left" dataKey="total_invertido" name="Invertido $" fill={C.invertido} radius={[5,5,0,0]} />
                <Bar yAxisId="left" dataKey="total_gastos"    name="Gastos $"    fill={C.gastos}    radius={[5,5,0,0]} />
                <Bar yAxisId="left" dataKey="balance"         name="Balance $"   fill={C.balancePos} radius={[5,5,0,0]}>
                  {data?.map((entry) => (
                    <Cell key={entry.month} fill={entry.balance >= 0 ? C.balancePos : C.balanceNeg} />
                  ))}
                </Bar>

                {/* Count bars */}
                <Bar yAxisId="right" dataKey="items_distintos" name="Ítems distintos" fill={C.itemsDistintos} radius={[5,5,0,0]} />
                <Bar yAxisId="right" dataKey="items_totales"   name="Ítems totales"   fill={C.itemsTotales}   radius={[5,5,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </>
        )}
      </CardContent>
    </Card>
  );
}
