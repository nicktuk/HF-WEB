'use client';

// Gráficos del módulo de reportes. Este archivo se importa SOLO con
// next/dynamic (ssr: false) desde ChartsLazy.tsx, así Recharts no suma peso
// al resto del admin.

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from 'recharts';
import { COLORES, ars, arsCorto, cantidad } from '@/lib/reportes';

const ALTO = 220;
const ANIM_MS = 300;

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(mq.matches);
    const on = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduce;
}

function useAngosto(): boolean {
  const [angosto, setAngosto] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    setAngosto(mq.matches);
    const on = (e: MediaQueryListEvent) => setAngosto(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return angosto;
}

type Formato = 'ars' | 'cantidad';
const fmtExacto = (f: Formato) => (f === 'ars' ? ars : (v: number) => cantidad(v));
const fmtEje = (f: Formato) => (f === 'ars' ? arsCorto : (v: number) => cantidad(v));

function TooltipLimpio({
  active,
  payload,
  label,
  formato,
  etiquetas,
}: TooltipProps<number, string> & { formato: Formato; etiquetas?: Record<string, string> }) {
  if (!active || !payload?.length) return null;
  const fmt = fmtExacto(formato);
  const titulo = (payload[0]?.payload as { tooltipLabel?: string })?.tooltipLabel ?? label;
  return (
    <div className="rounded-lg bg-white/95 px-3 py-2 text-xs shadow-lg ring-1 ring-zinc-200 backdrop-blur">
      {titulo && <p className="mb-1 font-medium text-zinc-500">{titulo}</p>}
      {payload
        .filter((p) => p.value !== undefined && p.value !== null)
        .map((p) => (
          <p key={String(p.dataKey)} className="flex items-center gap-2 tabular-nums text-zinc-900">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-zinc-500">{etiquetas?.[String(p.dataKey)] ?? p.name}</span>
            <span className="ml-auto font-semibold">{fmt(Number(p.value))}</span>
          </p>
        ))}
    </div>
  );
}

// ─── Sparkline (sin ejes) ────────────────────────────────────────────────

export function Sparkline({ datos, color = COLORES.principal }: { datos: number[]; color?: string }) {
  const reduce = useReducedMotion();
  const id = `spark-${color.replace('#', '')}`;
  const data = datos.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#${id})`}
          isAnimationActive={!reduce}
          animationDuration={ANIM_MS}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Área de facturación con período anterior punteado ──────────────────

export interface PuntoComparado {
  etiqueta: string;
  tooltipLabel: string;
  actual: number;
  anterior: number | null;
}

export function AreaComparativa({ data }: { data: PuntoComparado[] }) {
  const reduce = useReducedMotion();
  const angosto = useAngosto();
  return (
    <ResponsiveContainer width="100%" height={ALTO}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="area-actual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLORES.principal} stopOpacity={0.28} />
            <stop offset="100%" stopColor={COLORES.principal} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={COLORES.grilla} />
        <XAxis
          dataKey="etiqueta"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: COLORES.eje }}
          minTickGap={angosto ? 28 : 12}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => arsCorto(v)}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: COLORES.eje }}
          width={64}
          tickCount={4}
        />
        <Tooltip
          content={<TooltipLimpio formato="ars" etiquetas={{ actual: 'Este período', anterior: 'Período anterior' }} />}
          cursor={{ stroke: COLORES.contexto }}
        />
        <Area
          type="monotone"
          dataKey="actual"
          stroke={COLORES.principal}
          strokeWidth={2}
          fill="url(#area-actual)"
          isAnimationActive={!reduce}
          animationDuration={ANIM_MS}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="anterior"
          stroke={COLORES.secundario}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          dot={false}
          isAnimationActive={!reduce}
          animationDuration={ANIM_MS}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ─── Barras apiladas por canal (leyenda clickeable) ─────────────────────

export interface SerieCanal {
  key: string;
  nombre: string;
  color: string;
}

export function BarrasApiladas({ data, series }: { data: Record<string, number | string>[]; series: SerieCanal[] }) {
  const reduce = useReducedMotion();
  const angosto = useAngosto();
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const visibles = series.filter((s) => !ocultos.has(s.key));
  const ultima = visibles[visibles.length - 1]?.key;
  const toggle = (key: string) =>
    setOcultos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return (
    <ResponsiveContainer width="100%" height={ALTO + 28}>
      <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={COLORES.grilla} />
        <XAxis
          dataKey="etiqueta"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: COLORES.eje }}
          minTickGap={angosto ? 28 : 12}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v) => arsCorto(v)}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: COLORES.eje }}
          width={64}
          tickCount={4}
        />
        <Tooltip
          content={<TooltipLimpio formato="ars" etiquetas={Object.fromEntries(series.map((s) => [s.key, s.nombre]))} />}
          cursor={{ fill: 'rgba(148,163,184,0.12)' }}
        />
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
          onClick={(e) => toggle(String((e as { dataKey?: string }).dataKey))}
          formatter={(value, entry) => (
            <span style={{ color: ocultos.has(String((entry as { dataKey?: string }).dataKey)) ? COLORES.contexto : '#475569' }}>
              {value}
            </span>
          )}
        />
        {series.map((s) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.nombre}
            stackId="canal"
            fill={s.color}
            hide={ocultos.has(s.key)}
            radius={s.key === ultima ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            maxBarSize={36}
            isAnimationActive={!reduce}
            animationDuration={ANIM_MS}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── Barras horizontales (rankings) ─────────────────────────────────────

export interface FilaRanking {
  nombre: string;
  valor: number;
}

export function BarrasHorizontales({
  data,
  formato = 'ars',
  color = COLORES.principal,
}: {
  data: FilaRanking[];
  formato?: Formato;
  color?: string;
}) {
  const reduce = useReducedMotion();
  const angosto = useAngosto();
  const alto = Math.max(ALTO, data.length * 30 + 16);
  const corto = (s: string) => {
    const max = angosto ? 14 : 24;
    return s.length > max ? `${s.slice(0, max - 1)}…` : s;
  };
  return (
    <ResponsiveContainer width="100%" height={alto}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid horizontal={false} stroke={COLORES.grilla} />
        <XAxis
          type="number"
          tickFormatter={(v) => fmtEje(formato)(v)}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: COLORES.eje }}
          tickCount={angosto ? 3 : 5}
        />
        <YAxis
          type="category"
          dataKey="nombre"
          tickFormatter={corto}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: '#475569' }}
          width={angosto ? 96 : 150}
        />
        <Tooltip
          content={<TooltipLimpio formato={formato} etiquetas={{ valor: 'Valor' }} />}
          cursor={{ fill: 'rgba(148,163,184,0.12)' }}
        />
        <Bar
          dataKey="valor"
          fill={color}
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          isAnimationActive={!reduce}
          animationDuration={ANIM_MS}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
