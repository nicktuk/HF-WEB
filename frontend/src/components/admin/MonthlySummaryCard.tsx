'use client';

import { useState, useMemo, useEffect } from 'react';
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

const ALL_MONTHS = new Set([1,2,3,4,5,6,7,8,9,10,11,12]);

function fmtM(n: number): string {
  if (n === 0) return '$0';
  const abs = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${s}$${Math.round(abs / 1_000)}k`;
  return `${s}$${Math.round(abs)}`;
}

function aggregate(rows: MonthData[], label: string): MonthData {
  return rows.reduce(
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
    { month: 0, label, num_compras: 0, items_distintos: 0, items_totales: 0,
      total_invertido: 0, num_ventas: 0, importe_ventas: 0, total_gastos: 0, balance: 0 }
  );
}

function KPIItem({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-xl bg-white border border-zinc-100 px-4 py-3 shadow-sm min-w-0">
      <p className="text-xs text-zinc-400 font-medium truncate mb-1">{label}</p>
      <p className="text-xl font-extrabold tabular-nums leading-none" style={{ color }}>{value}</p>
      {sub && <p className="text-[11px] text-zinc-400 leading-none mt-1">{sub}</p>}
    </div>
  );
}

function KPIPanel({ entry, heading }: { entry: MonthData; heading: string }) {
  return (
    <div className="mb-5">
      <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">{heading}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
        <KPIItem label="Ventas"          value={fmtM(entry.importe_ventas)}  sub={`${entry.num_ventas} operaciones`} color={C.ventas} />
        <KPIItem label="Invertido"       value={fmtM(entry.total_invertido)} sub={`${entry.num_compras} compras`}   color={C.invertido} />
        <KPIItem label="Gastos"          value={fmtM(entry.total_gastos)}                                           color={C.gastos} />
        <KPIItem label="Balance"         value={fmtM(entry.balance)}                                                color={entry.balance >= 0 ? C.balancePos : C.balanceNeg} />
        <KPIItem label="Ítems distintos" value={String(entry.items_distintos)}                                      color={C.itemsDistintos} />
        <KPIItem label="Ítems totales"   value={String(entry.items_totales)}                                        color={C.itemsTotales} />
      </div>
    </div>
  );
}

export function MonthlySummaryCard({ apiKey }: { apiKey: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear]           = useState(currentYear);
  const [viewMode, setViewMode]   = useState<'monthly' | 'annual'>('monthly');
  const [activeMonths, setActiveMonths] = useState<Set<number>>(new Set(ALL_MONTHS));
  const [hoveredMonth, setHoveredMonth] = useState<MonthData | null>(null);
  const [isMobile, setIsMobile]   = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const { data, isLoading } = useQuery<MonthData[]>({
    queryKey: ['admin-stats-monthly-summary', year],
    queryFn: async () => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/stats/monthly-summary?year=${year}`,
        { headers: { 'X-Admin-API-Key': apiKey } }
      );
      if (!res.ok) throw new Error('Error');
      return res.json();
    },
    enabled: !!apiKey,
  });

  const toggleMonth = (month: number) => {
    setActiveMonths(prev => {
      const next = new Set(prev);
      if (next.has(month)) {
        if (next.size <= 1) return prev;
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
    setHoveredMonth(null);
  };

  const selectAll = () => {
    setActiveMonths(new Set(ALL_MONTHS));
    setHoveredMonth(null);
  };

  const filteredData  = useMemo(() => data?.filter(m => activeMonths.has(m.month)) ?? [], [data, activeMonths]);
  const selectionLabel = activeMonths.size === 12 ? `Total ${year}` : `${activeMonths.size} meses · ${year}`;
  const totals        = useMemo(() => aggregate(filteredData, selectionLabel), [filteredData, selectionLabel]);
  const chartData     = useMemo(
    () => viewMode === 'annual' ? [{ ...totals, label: String(year) }] : filteredData,
    [viewMode, filteredData, totals, year]
  );

  const kpiEntry   = hoveredMonth ?? totals;
  const kpiHeading = hoveredMonth ? `${hoveredMonth.label} ${year}` : selectionLabel;
  const years      = [currentYear - 1, currentYear];

  const btnBase    = 'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors';
  const btnActive  = `${btnBase} bg-zinc-800 text-white`;
  const btnInactive= `${btnBase} bg-zinc-100 text-zinc-400 hover:bg-zinc-200`;
  const toggleBase = 'px-3 py-1 rounded-lg text-sm font-medium transition-colors';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Resumen mensual</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Monthly / Annual toggle */}
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-0.5">
              <button
                onClick={() => setViewMode('monthly')}
                className={viewMode === 'monthly' ? `${toggleBase} bg-white shadow-sm text-zinc-900` : `${toggleBase} text-zinc-500`}
              >
                Mensual
              </button>
              <button
                onClick={() => setViewMode('annual')}
                className={viewMode === 'annual' ? `${toggleBase} bg-white shadow-sm text-zinc-900` : `${toggleBase} text-zinc-500`}
              >
                Anual
              </button>
            </div>
            {/* Year selector */}
            <div className="flex gap-1">
              {years.map((y) => (
                <button
                  key={y}
                  onClick={() => { setYear(y); setHoveredMonth(null); }}
                  className={y === year ? `${toggleBase} bg-zinc-900 text-white` : `${toggleBase} bg-zinc-100 text-zinc-600 hover:bg-zinc-200`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-zinc-400 text-sm">Cargando...</div>
        ) : (
          <>
            {/* KPI panel */}
            <KPIPanel entry={kpiEntry} heading={kpiHeading} />

            {/* Month filter buttons */}
            {data && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                <button onClick={selectAll} className={activeMonths.size === 12 ? btnActive : btnInactive}>
                  Todos
                </button>
                {data.map((m) => (
                  <button
                    key={m.month}
                    onClick={() => toggleMonth(m.month)}
                    className={activeMonths.has(m.month) ? btnActive : btnInactive}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            {/* Chart */}
            <div className="h-[300px] sm:h-[520px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: isMobile ? 28 : 48, left: 0, bottom: 0 }}
                  barGap={isMobile ? 1 : 3}
                  barCategoryGap={isMobile ? '8%' : '22%'}
                  onMouseMove={(state: any) => {
                    if (state?.isTooltipActive && state.activePayload?.[0]) {
                      setHoveredMonth(state.activePayload[0].payload);
                    }
                  }}
                  onMouseLeave={() => setHoveredMonth(null)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: isMobile ? 10 : 13, fill: '#52525b', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />

                  {/* Left axis — money */}
                  <YAxis
                    yAxisId="left"
                    tickFormatter={fmtM}
                    tick={{ fontSize: isMobile ? 10 : 12, fill: '#71717a' }}
                    axisLine={false}
                    tickLine={false}
                    width={isMobile ? 44 : 60}
                    tickCount={isMobile ? 4 : 6}
                  />

                  {/* Right axis — counts */}
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    allowDecimals={false}
                    tick={{ fontSize: isMobile ? 10 : 12, fill: '#71717a' }}
                    axisLine={false}
                    tickLine={false}
                    width={isMobile ? 24 : 36}
                    tickCount={isMobile ? 4 : 6}
                  />

                  <Tooltip content={() => null} cursor={{ fill: 'rgba(0,0,0,0.04)', rx: 6 }} />

                  <Legend
                    wrapperStyle={{ fontSize: isMobile ? 11 : 13, paddingTop: 16 }}
                    iconType="circle"
                    iconSize={8}
                  />
                  <ReferenceLine yAxisId="left" y={0} stroke="#d4d4d8" />

                  {/* Money bars */}
                  <Bar yAxisId="left" dataKey="importe_ventas"  name="Ventas $"   fill={C.ventas}     radius={[4,4,0,0]} />
                  <Bar yAxisId="left" dataKey="total_invertido" name="Invertido $" fill={C.invertido}  radius={[4,4,0,0]} />
                  <Bar yAxisId="left" dataKey="total_gastos"    name="Gastos $"    fill={C.gastos}     radius={[4,4,0,0]} />
                  <Bar yAxisId="left" dataKey="balance"         name="Balance $"   fill={C.balancePos} radius={[4,4,0,0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.month} fill={entry.balance >= 0 ? C.balancePos : C.balanceNeg} />
                    ))}
                  </Bar>

                  {/* Count bars */}
                  <Bar yAxisId="right" dataKey="items_distintos" name="Ítems distintos" fill={C.itemsDistintos} radius={[4,4,0,0]} />
                  <Bar yAxisId="right" dataKey="items_totales"   name="Ítems totales"   fill={C.itemsTotales}   radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
