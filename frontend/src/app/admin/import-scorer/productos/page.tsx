'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Pin, Trash2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISProducto, ISProductoUpdate, ISRubro } from '@/types';

const SEMAFORO: Record<string, { cls: string; label: string }> = {
  verde:    { cls: 'bg-green-100 text-green-700',  label: 'Verde'    },
  amarillo: { cls: 'bg-yellow-100 text-yellow-700', label: 'Amarillo' },
  rojo:     { cls: 'bg-red-100 text-red-700',       label: 'Rojo'     },
};

function SemaforoBadge({ semaforo }: { semaforo: string | null }) {
  if (!semaforo) return <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">—</span>;
  const { cls, label } = SEMAFORO[semaforo] ?? { cls: 'bg-gray-100 text-gray-400', label: semaforo };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

function ProductoRow({ p, onUpdate }: { p: ISProducto; onUpdate: (id: string, data: ISProductoUpdate) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <div
        className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer ${p.pinned ? 'bg-blue-50/30' : ''} ${p.descartado ? 'opacity-40' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <button className="text-gray-400 hover:text-gray-600 shrink-0" onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}>
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        {p.imagen_url ? (
          <img src={p.imagen_url} alt="" className="h-10 w-10 rounded-lg object-contain bg-gray-50 shrink-0" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-gray-100 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm truncate max-w-xs">{p.nombre}</span>
            <SemaforoBadge semaforo={p.semaforo} />
            {p.pinned && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">Pinned</span>}
            {p.flag_restriccion && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">{p.flag_restriccion}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
            <span>{p.rubro_nombre}</span>
            {p.ml_precio_ars != null && <span>ARS ${p.ml_precio_ars.toLocaleString('es-AR')}</span>}
            {p.mejor_precio_usd != null && <span>USD ${p.mejor_precio_usd.toFixed(2)} ({p.mejor_retailer_nombre})</span>}
            {p.costo_puesto_usd != null && <span>Puesto: ${p.costo_puesto_usd.toFixed(2)}</span>}
            {p.ratio_margen != null && <span className="font-medium">{p.ratio_margen.toFixed(2)}×</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => onUpdate(p.id, { pinned: !p.pinned })} title={p.pinned ? 'Desanclar' : 'Anclar'}
            className={`rounded-lg p-1.5 hover:bg-gray-100 ${p.pinned ? 'text-blue-500' : 'text-gray-400'}`}>
            <Pin className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onUpdate(p.id, { descartado: !p.descartado })} title={p.descartado ? 'Restaurar' : 'Descartar'}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="px-16 pb-4 pt-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-600 space-y-2">
          <div className="grid grid-cols-3 gap-4">
            <div><span className="font-medium block text-gray-400">Peso</span>{p.peso_kg != null ? `${p.peso_kg} kg` : '—'}</div>
            <div><span className="font-medium block text-gray-400">Tax USA</span>{p.sales_tax_usd != null ? `$${p.sales_tax_usd.toFixed(2)}` : '—'}</div>
            <div><span className="font-medium block text-gray-400">Flete</span>{p.costo_flete_usd != null ? `$${p.costo_flete_usd.toFixed(2)}` : '—'}</div>
            <div><span className="font-medium block text-gray-400">Vendidos ML</span>{p.ml_vendidos ?? '—'}</div>
            <div><span className="font-medium block text-gray-400">Pos. ranking</span>{p.ml_posicion_ranking ?? '—'}</div>
            <div><span className="font-medium block text-gray-400">Veces importado</span>{p.veces_importado}</div>
          </div>
          {p.ofertas.length > 0 && (
            <div>
              <span className="font-medium text-gray-500">Ofertas USA:</span>
              <div className="mt-1 space-y-0.5">
                {p.ofertas.map((o) => (
                  <div key={o.id} className="flex items-center gap-2">
                    <span className="text-gray-500">{o.retailer_nombre}</span>
                    <span className="font-medium">${o.precio_usd.toFixed(2)}</span>
                    {!o.en_stock && <span className="text-red-400">Sin stock</span>}
                    {o.en_clearance && <span className="text-orange-400">Clearance</span>}
                    {o.url && <a href={o.url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-0.5"><ExternalLink className="h-3 w-3" /></a>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {p.ml_url && (
            <div>
              <a href={p.ml_url} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                <ExternalLink className="h-3 w-3" /> Ver en Mercado Libre
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProductosPage() {
  const apiKey = useApiKey() || '';
  const qc = useQueryClient();
  const [toast, setToast] = useState('');
  const [filterRubro, setFilterRubro] = useState('');
  const [filterSemaforo, setFilterSemaforo] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const { data: rubros = [] } = useQuery({
    queryKey: ['is-rubros'],
    queryFn: () => importScorerApi.getRubros(apiKey),
    enabled: !!apiKey,
  });

  const { data: productos = [], isLoading, refetch } = useQuery({
    queryKey: ['is-productos', filterRubro, filterSemaforo, busqueda],
    queryFn: () => importScorerApi.getProductos(apiKey, {
      rubro_id: filterRubro || undefined,
      semaforo: filterSemaforo || undefined,
      q: busqueda || undefined,
      limit: 200,
    }),
    enabled: !!apiKey,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ISProductoUpdate }) => importScorerApi.updateProducto(apiKey, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['is-productos'] }),
  });

  const scoringMutation = useMutation({
    mutationFn: () => importScorerApi.recalcularScoring(apiKey),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['is-productos'] });
      showToast(`Scoring recalculado: ${(res as Record<string,number>).actualizados ?? 0} productos`);
    },
  });

  const conteo = { verde: 0, amarillo: 0, rojo: 0 };
  productos.forEach((p) => { if (p.semaforo) conteo[p.semaforo as keyof typeof conteo]++; });

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Productos</h1>
          <p className="text-sm text-gray-500 mt-0.5">Catálogo scrapeado con scoring de importación.</p>
        </div>
        <button onClick={() => scoringMutation.mutate()} disabled={scoringMutation.isPending}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${scoringMutation.isPending ? 'animate-spin' : ''}`} />
          Recalcular scoring
        </button>
      </div>

      {/* Semáforo summary */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(conteo).map(([s, c]) => {
          const { cls } = SEMAFORO[s];
          return (
            <button key={s} onClick={() => setFilterSemaforo(filterSemaforo === s ? '' : s)}
              className={`rounded-xl border-2 p-3 text-center transition-all ${filterSemaforo === s ? 'border-current' : 'border-gray-200'} ${cls}`}>
              <div className="text-2xl font-bold">{c}</div>
              <div className="text-xs capitalize">{s}</div>
            </button>
          );
        })}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto…"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48" />
        <select value={filterRubro} onChange={(e) => setFilterRubro(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos los rubros</option>
          {(rubros as ISRubro[]).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
        {(filterRubro || filterSemaforo || busqueda) && (
          <button onClick={() => { setFilterRubro(''); setFilterSemaforo(''); setBusqueda(''); }}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100">Limpiar ×</button>
        )}
        <span className="ml-auto text-xs text-gray-400 self-center">{productos.length} productos</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4,5].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : productos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-400">
          <div className="text-2xl mb-2">📦</div>
          No hay productos aún. Configurá rubros con ml_category_id y ejecutá un scraping.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
          {productos.map((p) => (
            <ProductoRow key={p.id} p={p}
              onUpdate={(id, data) => updateMutation.mutate({ id, data })} />
          ))}
        </div>
      )}
    </div>
  );
}
