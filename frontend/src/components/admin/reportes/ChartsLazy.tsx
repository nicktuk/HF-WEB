'use client';

// Puntos de entrada livianos: cada gráfico se baja recién cuando se muestra
// (next/dynamic, ssr: false) y mientras tanto se ve un skeleton del mismo alto.

import dynamic from 'next/dynamic';
export type { PuntoComparado, SerieCanal, FilaRanking } from './charts';

const ChartSkeleton = ({ alto = 220 }: { alto?: number }) => (
  <div className="w-full animate-pulse rounded-lg bg-zinc-100" style={{ height: alto }} />
);

export const Sparkline = dynamic(() => import('./charts').then((m) => m.Sparkline), {
  ssr: false,
  loading: () => <div className="h-9" />,
});

export const AreaComparativa = dynamic(() => import('./charts').then((m) => m.AreaComparativa), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});

export const BarrasApiladas = dynamic(() => import('./charts').then((m) => m.BarrasApiladas), {
  ssr: false,
  loading: () => <ChartSkeleton alto={248} />,
});

export const BarrasHorizontales = dynamic(() => import('./charts').then((m) => m.BarrasHorizontales), {
  ssr: false,
  loading: () => <ChartSkeleton />,
});
