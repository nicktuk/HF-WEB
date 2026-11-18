'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, Download, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pct } from '@/lib/reportes';

// ─── Variación ▲▼ ────────────────────────────────────────────────────────

/** `puntos`: la variación viene en puntos porcentuales (para KPIs que ya son %). */
export function Variacion({
  valor,
  puntos = false,
  enDias = false,
  inverso = false,
}: {
  valor: string | null | undefined;
  puntos?: boolean;
  enDias?: boolean;
  inverso?: boolean;
}) {
  if (valor === null || valor === undefined) {
    return <span className="text-xs text-zinc-400">sin base previa</span>;
  }
  const n = Number(valor);
  if (n === 0) return <span className="text-xs font-medium text-zinc-500">= sin cambios</span>;
  const sube = n > 0;
  const bueno = inverso ? !sube : sube;
  const Icono = sube ? ArrowUp : ArrowDown;
  const abs = Math.abs(n).toLocaleString('es-AR', { maximumFractionDigits: 1 });
  const texto = puntos ? `${abs} pp` : enDias ? `${abs} d` : pct(Math.abs(n));
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums', bueno ? 'text-emerald-600' : 'text-rose-600')}>
      <Icono className="h-3 w-3" aria-hidden />
      <span className="sr-only">{sube ? 'Sube' : 'Baja'}</span>
      {texto}
    </span>
  );
}

// ─── Tarjeta KPI ─────────────────────────────────────────────────────────

export function KpiCard({
  titulo,
  valor,
  detalle,
  variacion,
  children,
  className,
}: {
  titulo: string;
  valor: string;
  detalle?: ReactNode;
  variacion?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex min-w-0 flex-col rounded-xl bg-white p-3 ring-1 ring-zinc-200/70 sm:p-4', className)}>
      <p className="text-xs font-medium leading-tight text-zinc-500">{titulo}</p>
      <p className="mt-1 truncate text-xl font-semibold tracking-tight text-zinc-900 tabular-nums sm:text-2xl">{valor}</p>
      <div className="mt-0.5 flex min-h-[18px] flex-wrap items-center gap-x-2">
        {variacion}
        {detalle && <span className="text-xs text-zinc-400">{detalle}</span>}
      </div>
      {children && <div className="mt-auto pt-2">{children}</div>}
    </div>
  );
}

// ─── Panel genérico ──────────────────────────────────────────────────────

export function Panel({ titulo, accion, children, className }: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-xl bg-white p-3 ring-1 ring-zinc-200/70 sm:p-4', className)}>
      {(titulo || accion) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {titulo && <h3 className="text-sm font-semibold text-zinc-800">{titulo}</h3>}
          {accion}
        </div>
      )}
      {children}
    </section>
  );
}

// ─── Avisos del backend ──────────────────────────────────────────────────

export function Advertencias({ items }: { items?: string[] }) {
  const [abierto, setAbierto] = useState(false);
  if (!items?.length) return null;
  // Los que cuentan un hueco de datos (empiezan con un número) van primero y siempre visibles.
  const importantes = items.filter((t) => /^\d/.test(t));
  const resto = items.filter((t) => !/^\d/.test(t));
  return (
    <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <div className="flex gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          {importantes.map((t) => (
            <p key={t} className="font-medium">{t}</p>
          ))}
          {resto.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setAbierto((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 hover:underline"
                aria-expanded={abierto}
              >
                {abierto ? 'Ocultar notas de cálculo' : `Cómo se calcula (${resto.length})`}
                <ChevronDown className={cn('h-3 w-3 transition-transform', abierto && 'rotate-180')} />
              </button>
              {abierto && (
                <ul className="list-disc space-y-0.5 pl-4 text-xs text-amber-800">
                  {resto.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Estados ─────────────────────────────────────────────────────────────

export function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-white ring-1 ring-zinc-200/70" />
        ))}
      </div>
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-white ring-1 ring-zinc-200/70" />
      ))}
    </div>
  );
}

export function Vacio({ texto = 'No hay datos para este período y filtros.' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-white px-4 py-10 text-center ring-1 ring-zinc-200/70">
      <Inbox className="h-8 w-8 text-zinc-300" aria-hidden />
      <p className="text-sm text-zinc-500">{texto}</p>
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'No se pudo cargar el reporte';
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl bg-white px-4 py-8 text-center ring-1 ring-rose-200">
      <p className="text-sm font-medium text-rose-700">{msg}</p>
      {onRetry && (
        <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm text-white">
          <RefreshCw className="h-4 w-4" /> Reintentar
        </button>
      )}
    </div>
  );
}

// ─── Botón CSV ───────────────────────────────────────────────────────────

export function BotonCsv({ onExport }: { onExport: () => Promise<void> }) {
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'error'>('idle');
  return (
    <button
      type="button"
      onClick={async () => {
        setEstado('cargando');
        try {
          await onExport();
          setEstado('idle');
        } catch {
          setEstado('error');
        }
      }}
      disabled={estado === 'cargando'}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition-colors disabled:opacity-60',
        estado === 'error' ? 'text-rose-700 ring-rose-200' : 'text-zinc-700 ring-zinc-200 hover:bg-zinc-50'
      )}
    >
      {estado === 'cargando' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {estado === 'error' ? 'Error, reintentar' : 'Exportar CSV'}
    </button>
  );
}

// ─── Selector segmentado ─────────────────────────────────────────────────

export function Segmentado<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  opciones: { id: T; label: string }[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="inline-flex rounded-lg bg-zinc-100 p-0.5">
      {opciones.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valor === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
            valor === o.id ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Lista ordenable: tabla en desktop, tarjetas apiladas en mobile ───────

export interface Columna<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  /** Valor para ordenar; si falta, la columna no es ordenable. null = al final. */
  sort?: (row: T) => number | string | null;
  align?: 'left' | 'right';
  /** En la tarjeta mobile: 'titulo' va arriba en negrita; 'oculta' no se muestra. */
  mobile?: 'titulo' | 'oculta';
}

export function ListaOrdenable<T>({
  filas,
  columnas,
  clave,
  ordenInicial,
  vacio,
}: {
  filas: T[];
  columnas: Columna<T>[];
  clave: (row: T) => string | number;
  ordenInicial?: { key: string; dir: 'asc' | 'desc' };
  vacio?: string;
}) {
  const [orden, setOrden] = useState(ordenInicial ?? null);
  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const col = columnas.find((c) => c.key === orden.key);
    if (!col?.sort) return filas;
    const get = col.sort;
    return [...filas].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = typeof va === 'string' && typeof vb === 'string' ? va.localeCompare(vb, 'es') : Number(va) - Number(vb);
      return orden.dir === 'asc' ? cmp : -cmp;
    });
  }, [filas, columnas, orden]);

  if (!filas.length) return <Vacio texto={vacio} />;

  const ordenables = columnas.filter((c) => c.sort);
  const clickHeader = (key: string) =>
    setOrden((prev) => (prev?.key === key ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  const titulo = columnas.find((c) => c.mobile === 'titulo') ?? columnas[0];

  return (
    <div>
      {/* Mobile: selector de orden + tarjetas */}
      <div className="md:hidden">
        {ordenables.length > 0 && (
          <div className="mb-2 flex items-center gap-2">
            <label className="text-xs text-zinc-500" htmlFor="orden-mobile">Ordenar por</label>
            <select
              id="orden-mobile"
              value={orden ? `${orden.key}:${orden.dir}` : ''}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(':');
                setOrden(key ? { key, dir: dir as 'asc' | 'desc' } : null);
              }}
              className="min-w-0 flex-1 rounded-lg border-0 bg-white py-1.5 text-sm ring-1 ring-zinc-200"
            >
              {ordenables.flatMap((c) => [
                <option key={`${c.key}:desc`} value={`${c.key}:desc`}>{c.label} ↓</option>,
                <option key={`${c.key}:asc`} value={`${c.key}:asc`}>{c.label} ↑</option>,
              ])}
            </select>
          </div>
        )}
        <ul className="space-y-2">
          {ordenadas.map((row) => (
            <li key={clave(row)} className="rounded-xl bg-white p-3 ring-1 ring-zinc-200/70">
              <div className="mb-2 text-sm font-semibold text-zinc-900">{titulo.render(row)}</div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                {columnas
                  .filter((c) => c !== titulo && c.mobile !== 'oculta')
                  .map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-[11px] text-zinc-500">{c.label}</dt>
                      <dd className="truncate text-sm tabular-nums text-zinc-900">{c.render(row)}</dd>
                    </div>
                  ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>

      {/* Desktop: tabla */}
      <div className="hidden overflow-x-auto rounded-xl bg-white ring-1 ring-zinc-200/70 md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
              {columnas.map((c) => (
                <th key={c.key} scope="col" className={cn('px-3 py-2 font-medium', c.align === 'right' && 'text-right')}>
                  {c.sort ? (
                    <button
                      type="button"
                      onClick={() => clickHeader(c.key)}
                      className={cn('inline-flex items-center gap-1 hover:text-zinc-900', orden?.key === c.key && 'text-zinc-900')}
                      aria-sort={orden?.key === c.key ? (orden.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      {c.label}
                      {orden?.key === c.key && (orden.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((row) => (
              <tr key={clave(row)} className="border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60">
                {columnas.map((c) => (
                  <td key={c.key} className={cn('px-3 py-2 tabular-nums text-zinc-800', c.align === 'right' && 'text-right')}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
