'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { CalendarDays } from 'lucide-react';
import type { ApexOptions } from 'apexcharts';

const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

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
  balance:        '#8b5cf6',
  balanceNeg:     '#f97316',
  itemsDistintos: '#06b6d4',
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
        <KPIItem label="Invertido"       value={fmtM(entry.total_invertido)} sub={`${entry.num_compras} compras`}    color={C.invertido} />
        <KPIItem label="Gastos"          value={fmtM(entry.total_gastos)}                                             color={C.gastos} />
        <KPIItem label="Balance"         value={fmtM(entry.balance)}                                                  color={entry.balance >= 0 ? C.balance : C.balanceNeg} />
        <KPIItem label="Ítems distintos" value={String(entry.items_distintos)}                                        color={C.itemsDistintos} />
        <KPIItem label="Ítems totales"   value={String(entry.items_totales)}                                          color={C.itemsTotales} />
      </div>
    </div>
  );
}

export function MonthlySummaryCard({ apiKey }: { apiKey: string }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear]                 = useState(currentYear);
  const [viewMode, setViewMode]         = useState<'monthly' | 'annual'>('monthly');
  const [activeMonths, setActiveMonths] = useState<Set<number>>(new Set(ALL_MONTHS));
  const [hoveredMonth, setHoveredMonth] = useState<MonthData | null>(null);

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
    setActiveMonths(prev => prev.size === ALL_MONTHS.size ? new Set() : new Set(ALL_MONTHS));
    setHoveredMonth(null);
  };

  const filteredData   = useMemo(() => data?.filter(m => activeMonths.has(m.month)) ?? [], [data, activeMonths]);
  const selectionLabel = activeMonths.size === 12 ? `Total ${year}` : `${activeMonths.size} meses · ${year}`;
  const totals         = useMemo(() => aggregate(filteredData, selectionLabel), [filteredData, selectionLabel]);
  const chartData      = useMemo(
    () => viewMode === 'annual' ? [{ ...totals, label: String(year) }] : filteredData,
    [viewMode, filteredData, totals, year]
  );

  const kpiEntry   = hoveredMonth ?? totals;
  const kpiHeading = hoveredMonth ? `${hoveredMonth.label} ${year}` : selectionLabel;
  const years      = [currentYear - 1, currentYear];

  const series = useMemo(() => [
    { name: 'Ventas $',        data: chartData.map(d => d.importe_ventas) },
    { name: 'Invertido $',     data: chartData.map(d => d.total_invertido) },
    { name: 'Gastos $',        data: chartData.map(d => d.total_gastos) },
    { name: 'Balance $',       data: chartData.map(d => d.balance) },
    { name: 'Ítems distintos', data: chartData.map(d => d.items_distintos) },
    { name: 'Ítems totales',   data: chartData.map(d => d.items_totales) },
  ], [chartData]);

  const options: ApexOptions = useMemo(() => ({
    chart: {
      type: 'bar' as const,
      toolbar: { show: false },
      fontFamily: 'inherit',
      background: 'transparent',
      animations: { enabled: true, speed: 350, animateGradually: { enabled: false } },
      events: {
        dataPointMouseEnter: (_e: MouseEvent, _ctx: unknown, config: unknown) => {
          const idx = (config as { dataPointIndex?: number })?.dataPointIndex;
          if (idx != null) {
            const entry = chartData[idx];
            if (entry) setHoveredMonth(entry as MonthData);
          }
        },
        mouseLeave: () => setHoveredMonth(null),
      },
    },
    plotOptions: {
      bar: {
        borderRadius: 5,
        borderRadiusApplication: 'end' as const,
        columnWidth: chartData.length === 1 ? '20%' : '72%',
        dataLabels: { position: 'top' },
      },
    },
    colors: [C.ventas, C.invertido, C.gastos, C.balance, C.itemsDistintos, C.itemsTotales],
    xaxis: {
      categories: chartData.map(d => d.label),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { fontSize: '12px', fontWeight: '600', colors: '#52525b' },
      },
    },
    yaxis: [
      {
        seriesName: 'Ventas $',
        labels: {
          formatter: fmtM,
          style: { colors: ['#71717a'], fontSize: '11px' },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      { seriesName: 'Ventas $', show: false },
      { seriesName: 'Ventas $', show: false },
      { seriesName: 'Ventas $', show: false },
      {
        seriesName: 'Ítems distintos',
        opposite: true,
        labels: {
          formatter: (v: number) => String(Math.round(v)),
          style: { colors: ['#71717a'], fontSize: '11px' },
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      { seriesName: 'Ítems distintos', opposite: true, show: false },
    ],
    annotations: {
      yaxis: [
        { y: 0, borderColor: '#d4d4d8', borderWidth: 1, strokeDashArray: 0 },
      ],
    },
    grid: {
      borderColor: '#f4f4f5',
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      padding: { left: 4, right: 4 },
    },
    tooltip: {
      shared: true,
      intersect: false,
      theme: 'light',
      style: { fontSize: '12px' },
      y: {
        formatter: (value: number, opts?: { seriesIndex?: number }) => {
          const idx = opts?.seriesIndex ?? 0;
          return idx < 4 ? fmtM(value) : String(Math.round(value));
        },
      },
    },
    legend: {
      position: 'bottom',
      horizontalAlign: 'center',
      fontSize: '12px',
      markers: { size: 6 },
      itemMargin: { horizontal: 8, vertical: 6 },
      onItemClick: { toggleDataSeries: true },
      onItemHover: { highlightDataSeries: true },
    },
    dataLabels: { enabled: false },
    states: {
      hover: { filter: { type: 'darken', value: 0.88 } },
      active: { filter: { type: 'darken', value: 0.75 } },
    },
    responsive: [
      {
        breakpoint: 640,
        options: {
          plotOptions: { bar: { borderRadius: 3, columnWidth: '85%' } },
          legend: { fontSize: '11px', markers: { size: 5 } },
          yaxis: [
            {
              seriesName: 'Ventas $',
              labels: { formatter: fmtM, style: { colors: ['#71717a'], fontSize: '10px' } },
              axisBorder: { show: false }, axisTicks: { show: false },
            },
            { seriesName: 'Ventas $', show: false },
            { seriesName: 'Ventas $', show: false },
            { seriesName: 'Ventas $', show: false },
            { seriesName: 'Ítems distintos', opposite: true, show: false },
            { seriesName: 'Ítems distintos', opposite: true, show: false },
          ],
          chart: {
            toolbar: { show: false },
          },
        },
      },
    ],
  }), [chartData]);

  const allSelected = activeMonths.size === ALL_MONTHS.size;
  const btnBase     = 'px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors';
  const btnActive   = `${btnBase} bg-zinc-800 text-white`;
  const btnInactive = `${btnBase} bg-zinc-100 text-zinc-400 hover:bg-zinc-200`;
  const toggleBase  = 'px-3 py-1 rounded-lg text-sm font-medium transition-colors';

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-zinc-600" />
            <h2 className="text-lg font-semibold text-zinc-900">Resumen mensual</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <KPIPanel entry={kpiEntry} heading={kpiHeading} />

            {data && (
              <div className="flex flex-wrap gap-1.5 mb-5">
                <button onClick={selectAll} className={allSelected ? btnActive : btnInactive} title={allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}>
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

            <div className="h-[300px] sm:h-[520px]">
              <ReactApexChart
                type="bar"
                series={series}
                options={options}
                height="100%"
                width="100%"
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
