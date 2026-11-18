'use client';

import { Suspense, useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { useAuth, useIsSuperadmin } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { hoyAR, rangoPreset, type Preset } from '@/lib/reportes';
import { Filtros, type ValoresFiltro } from '@/components/admin/reportes/Filtros';
import {
  ClientesTab,
  ProductosTab,
  ResumenTab,
  StockTab,
  VendedorasTab,
  VentasTab,
  type TabProps,
} from '@/components/admin/reportes/tabs';

const TABS = [
  { id: 'resumen', label: 'Resumen', Comp: ResumenTab },
  { id: 'ventas', label: 'Ventas', Comp: VentasTab },
  { id: 'productos', label: 'Productos', Comp: ProductosTab },
  { id: 'stock', label: 'Stock parado', Comp: StockTab },
  { id: 'vendedoras', label: 'Vendedoras', Comp: VendedorasTab },
  { id: 'clientes', label: 'Clientes', Comp: ClientesTab },
] as const;

type TabId = (typeof TABS)[number]['id'];

// Parámetros propios de cada pestaña (también viajan en la URL).
const EXTRAS = ['agrupar', 'metrica', 'dias_min', 'vista'] as const;

function ReportesInner() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const apiKey = useAuth((s) => s.apiKey);
  const isSuperadmin = useIsSuperadmin();

  const tab = (TABS.find((t) => t.id === sp.get('tab'))?.id ?? 'resumen') as TabId;

  const valores: ValoresFiltro = useMemo(() => {
    const preset = (sp.get('preset') as Preset) || '30d';
    const rango = preset === 'custom' ? null : rangoPreset(preset);
    const hoy = hoyAR();
    return {
      preset,
      desde: rango?.desde ?? sp.get('desde') ?? hoy,
      hasta: rango?.hasta ?? sp.get('hasta') ?? hoy,
      canal: sp.get('canal') ?? '',
      deposito_id: sp.get('deposito_id') ?? '',
      vendedora_id: sp.get('vendedora_id') ?? '',
      estado: sp.get('estado') ?? 'todas',
    };
  }, [sp]);

  const extra = useMemo(() => {
    const out: Record<string, string> = {};
    EXTRAS.forEach((k) => {
      const v = sp.get(k);
      if (v) out[k] = v;
    });
    return out;
  }, [sp]);

  const actualizarUrl = useCallback(
    (cambios: Record<string, string | null>) => {
      const next = new URLSearchParams(sp.toString());
      Object.entries(cambios).forEach(([k, v]) => {
        if (v === null || v === '') next.delete(k);
        else next.set(k, v);
      });
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [sp, router, pathname]
  );

  const onFiltro = (c: Partial<ValoresFiltro>) => {
    const cambios: Record<string, string | null> = {};
    if (c.preset) {
      cambios.preset = c.preset === '30d' ? null : c.preset;
      if (c.preset === 'custom') {
        // Arranca el personalizado con el rango que se estaba viendo.
        cambios.desde = valores.desde;
        cambios.hasta = valores.hasta;
      } else {
        cambios.desde = null;
        cambios.hasta = null;
      }
    }
    if (c.desde !== undefined) cambios.desde = c.desde;
    if (c.hasta !== undefined) cambios.hasta = c.hasta;
    if (c.canal !== undefined) cambios.canal = c.canal;
    if (c.deposito_id !== undefined) cambios.deposito_id = c.deposito_id;
    if (c.vendedora_id !== undefined) cambios.vendedora_id = c.vendedora_id;
    if (c.estado !== undefined) cambios.estado = c.estado === 'todas' ? null : c.estado;
    actualizarUrl(cambios);
  };

  // Filtros que viajan a la API (comunes a todas las pestañas).
  const params = useMemo(() => {
    const p = new URLSearchParams({ desde: valores.desde, hasta: valores.hasta });
    if (valores.canal) p.set('canal', valores.canal);
    if (valores.deposito_id) p.set('deposito_id', valores.deposito_id);
    if (valores.vendedora_id) p.set('vendedora_id', valores.vendedora_id);
    if (valores.estado !== 'todas') p.set('estado', valores.estado);
    return p;
  }, [valores]);

  const depositos = useQuery({
    queryKey: ['reportes', 'depositos'],
    queryFn: () => adminApi.getDeposits(apiKey!),
    enabled: !!apiKey && isSuperadmin,
    staleTime: 5 * 60_000,
  });
  const vendedoras = useQuery({
    queryKey: ['reportes', 'vendedoras-lista'],
    queryFn: () => adminApi.getCatalogSellers(apiKey!),
    enabled: !!apiKey && isSuperadmin,
    staleTime: 5 * 60_000,
  });

  if (!apiKey) return null;
  if (!isSuperadmin) {
    return <p className="p-6 text-sm text-zinc-600">Los reportes están disponibles solo para administradores.</p>;
  }

  const Activa = TABS.find((t) => t.id === tab)!.Comp as (p: TabProps) => JSX.Element;

  return (
    <div className="mx-auto max-w-6xl space-y-3 pb-10">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[#2c5c88]" aria-hidden />
        <h1 className="text-lg font-semibold text-zinc-900 sm:text-xl">Reportes</h1>
        <span className="text-xs text-zinc-400">Canal minorista</span>
      </div>

      <Filtros
        valores={valores}
        onChange={onFiltro}
        depositos={(depositos.data ?? []).filter((d) => d.is_active)}
        vendedoras={vendedoras.data ?? []}
        ocultarFechas={tab === 'stock'}
      />

      <nav aria-label="Secciones del reporte" className="grid grid-cols-3 gap-1 rounded-xl bg-zinc-200/60 p-1 sm:flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => actualizarUrl({ tab: t.id === 'resumen' ? null : t.id })}
            aria-current={tab === t.id ? 'page' : undefined}
            className={cn(
              'rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:flex-1 sm:text-sm',
              tab === t.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-600 hover:text-zinc-900'
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <Activa apiKey={apiKey} params={params} extra={extra} setExtra={actualizarUrl} />
    </div>
  );
}

export default function ReportesPage() {
  return (
    <Suspense fallback={null}>
      <ReportesInner />
    </Suspense>
  );
}
