'use client';

import { useState } from 'react';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PRESETS, fecha, type Preset } from '@/lib/reportes';
import type { CatalogSeller, Deposit } from '@/types';

export interface ValoresFiltro {
  preset: Preset;
  desde: string;
  hasta: string;
  canal: string;
  deposito_id: string;
  vendedora_id: string;
  estado: string;
}

const CANALES = [
  { id: '', label: 'Todos' },
  { id: 'admin', label: 'Admin' },
  { id: 'vendedor', label: 'Vendedor (bot)' },
];

const ESTADOS = [
  { id: 'todas', label: 'Todas' },
  { id: 'entregadas', label: 'Entregadas' },
  { id: 'cobradas', label: 'Cobradas' },
];

const selectCls =
  'w-full rounded-lg border-0 bg-white py-2 pl-3 pr-8 text-sm text-zinc-900 ring-1 ring-zinc-200 focus:ring-2 focus:ring-[#2c5c88]';

export function Filtros({
  valores,
  onChange,
  depositos,
  vendedoras,
  ocultarFechas = false,
}: {
  valores: ValoresFiltro;
  onChange: (cambios: Partial<ValoresFiltro>) => void;
  depositos: Deposit[];
  vendedoras: CatalogSeller[];
  ocultarFechas?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);

  const resumen = [
    ocultarFechas ? 'Stock actual' : valores.preset === 'custom' ? `${fecha(valores.desde)} – ${fecha(valores.hasta)}` : PRESETS.find((p) => p.id === valores.preset)?.label,
    valores.canal && CANALES.find((c) => c.id === valores.canal)?.label,
    valores.deposito_id && depositos.find((d) => String(d.id) === valores.deposito_id)?.name,
    valores.vendedora_id && vendedoras.find((v) => String(v.id) === valores.vendedora_id)?.nombre,
    valores.estado !== 'todas' && ESTADOS.find((e) => e.id === valores.estado)?.label,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="rounded-xl bg-white ring-1 ring-zinc-200/70">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left md:hidden"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="panel-filtros"
      >
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-zinc-500" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-800">{resumen}</span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-zinc-400 transition-transform', abierto && 'rotate-180')} />
      </button>

      <div id="panel-filtros" className={cn('space-y-3 p-3 md:block', abierto ? 'block border-t border-zinc-100 md:border-0' : 'hidden')}>
        {!ocultarFechas && (
          <div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Período">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={valores.preset === p.id}
                  onClick={() => onChange({ preset: p.id })}
                  className={cn(
                    'rounded-full px-3 py-1 text-sm font-medium transition-colors',
                    valores.preset === p.id ? 'bg-[#0D1B2A] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {valores.preset === 'custom' && (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-sm">
                <label className="text-xs text-zinc-500">
                  Desde
                  <input
                    type="date"
                    value={valores.desde}
                    max={valores.hasta}
                    onChange={(e) => e.target.value && onChange({ desde: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border-0 py-1.5 text-sm ring-1 ring-zinc-200"
                  />
                </label>
                <label className="text-xs text-zinc-500">
                  Hasta
                  <input
                    type="date"
                    value={valores.hasta}
                    min={valores.desde}
                    onChange={(e) => e.target.value && onChange({ hasta: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border-0 py-1.5 text-sm ring-1 ring-zinc-200"
                  />
                </label>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {!ocultarFechas && (
            <label className="text-xs text-zinc-500">
              Canal
              <select className={cn(selectCls, 'mt-0.5')} value={valores.canal} onChange={(e) => onChange({ canal: e.target.value })}>
                {CANALES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </label>
          )}
          <label className="text-xs text-zinc-500">
            Depósito
            <select className={cn(selectCls, 'mt-0.5')} value={valores.deposito_id} onChange={(e) => onChange({ deposito_id: e.target.value })}>
              <option value="">Todos</option>
              {depositos.map((d) => (
                <option key={d.id} value={String(d.id)}>{d.name}</option>
              ))}
            </select>
          </label>
          {!ocultarFechas && (
            <label className="text-xs text-zinc-500">
              Vendedora
              <select className={cn(selectCls, 'mt-0.5')} value={valores.vendedora_id} onChange={(e) => onChange({ vendedora_id: e.target.value })}>
                <option value="">Todas</option>
                {vendedoras.map((v) => (
                  <option key={v.id} value={String(v.id)}>{v.nombre}</option>
                ))}
              </select>
            </label>
          )}
          {!ocultarFechas && (
            <label className="text-xs text-zinc-500">
              Estado
              <select className={cn(selectCls, 'mt-0.5')} value={valores.estado} onChange={(e) => onChange({ estado: e.target.value })}>
                {ESTADOS.map((e) => (
                  <option key={e.id} value={e.id}>{e.label}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
