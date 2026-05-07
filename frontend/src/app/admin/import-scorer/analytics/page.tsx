'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { RefreshCw, Play } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';

export default function AnalyticsPage() {
  const apiKey = useApiKey() || '';
  const qc = useQueryClient();
  const [tab, setTab] = useState<'general' | 'calibracion'>('general');
  const [toast, setToast] = useState('');
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const { data: analytics, isLoading, refetch } = useQuery({
    queryKey: ['is-analytics'],
    queryFn: () => importScorerApi.getAnalytics(apiKey),
    enabled: !!apiKey,
  });

  const { data: calibracion, isLoading: loadingCal } = useQuery({
    queryKey: ['is-calibracion'],
    queryFn: () => importScorerApi.getCalibracion(apiKey),
    enabled: !!apiKey && tab === 'calibracion',
  });

  const scrapeMutation = useMutation({
    mutationFn: () => importScorerApi.triggerScrape(apiKey),
    onSuccess: () => showToast('Scraping iniciado en background'),
  });

  const scoringMutation = useMutation({
    mutationFn: () => importScorerApi.recalcularScoring(apiKey),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['is-analytics'] }); showToast(`Scoring recalculado: ${(res as Record<string,number>).actualizados ?? 0} productos`); },
  });

  const a = analytics as Record<string, unknown> | undefined;
  const porSemaforo = (a?.por_semaforo ?? {}) as Record<string, number>;
  const porRubro = (a?.por_rubro ?? []) as Array<{ rubro: string; productos: number }>;
  const logs = (a?.scrape_logs ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Resumen del sistema, calibración de scoring e historial de scraping.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => scrapeMutation.mutate()} disabled={scrapeMutation.isPending}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Play className={`h-4 w-4 ${scrapeMutation.isPending ? 'animate-spin' : ''}`} />
            Scrapear ahora
          </button>
          <button onClick={() => scoringMutation.mutate()} disabled={scoringMutation.isPending}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${scoringMutation.isPending ? 'animate-spin' : ''}`} />
            Recalcular scoring
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['general', 'calibracion'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'general' ? 'General' : 'Calibración'}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        isLoading ? (
          <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-4">
            {/* Semáforo */}
            <div className="grid grid-cols-4 gap-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                <div className="text-3xl font-bold text-gray-800">{a?.total_productos as number ?? 0}</div>
                <div className="text-xs text-gray-400 mt-1">Total productos</div>
              </div>
              {Object.entries({ verde: 'bg-green-50 text-green-700', amarillo: 'bg-yellow-50 text-yellow-700', rojo: 'bg-red-50 text-red-700' }).map(([s, cls]) => (
                <div key={s} className={`rounded-xl border-0 p-4 text-center ${cls}`}>
                  <div className="text-3xl font-bold">{porSemaforo[s] ?? 0}</div>
                  <div className="text-xs mt-1 capitalize">{s}</div>
                </div>
              ))}
            </div>

            {/* Por rubro + logs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-700">Top rubros</div>
                <div className="divide-y divide-gray-100">
                  {porRubro.map(({ rubro, productos }) => (
                    <div key={rubro} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-gray-700 truncate">{rubro}</span>
                      <span className="text-gray-500 font-medium shrink-0 ml-2">{productos}</span>
                    </div>
                  ))}
                  {porRubro.length === 0 && <div className="px-4 py-4 text-sm text-gray-400">Sin datos</div>}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 text-sm font-medium text-gray-700">Últimos scrapings</div>
                <div className="divide-y divide-gray-100">
                  {logs.map((l, i) => (
                    <div key={i} className="px-4 py-2.5 text-xs">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">{l.fuente as string}</span>
                        <span className="text-gray-400">{l.duracion_ms ? `${((l.duracion_ms as number) / 1000).toFixed(1)}s` : ''}</span>
                      </div>
                      <div className="text-gray-400 mt-0.5">
                        {new Date(l.fecha as string).toLocaleString('es-AR')} · {l.productos_act as number} acts · {l.errores as number} errores
                      </div>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="px-4 py-4 text-sm text-gray-400">Sin historial</div>}
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {tab === 'calibracion' && (
        loadingCal ? (
          <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-4">
            {calibracion && (
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <div className="text-2xl font-bold text-gray-800">{(calibracion as Record<string,unknown>).n_calibracion as number ?? 0}</div>
                  <div className="text-xs text-gray-400 mt-1">Productos calibrando</div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                  <div className="text-2xl font-bold text-gray-800">
                    {(calibracion as Record<string,unknown>).mae != null ? ((calibracion as Record<string,unknown>).mae as number).toFixed(3) : '—'}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">MAE (error absoluto medio)</div>
                </div>
              </div>
            )}

            {((calibracion as Record<string,unknown>)?.productos as Array<Record<string,unknown>>)?.length > 0 && (
              <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-medium">Producto</th>
                      <th className="text-right px-4 py-2.5 font-medium">Ratio estimado</th>
                      <th className="text-right px-4 py-2.5 font-medium">Margen real</th>
                      <th className="text-right px-4 py-2.5 font-medium">Error</th>
                      <th className="text-right px-4 py-2.5 font-medium">Importaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {((calibracion as Record<string,unknown>)?.productos as Array<Record<string,unknown>>).map((p) => (
                      <tr key={p.id as string} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-700 max-w-xs truncate">{p.nombre as string}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{p.ratio_estimado != null ? `${(p.ratio_estimado as number).toFixed(2)}×` : '—'}</td>
                        <td className="px-4 py-2.5 text-right text-gray-600">{p.margen_real != null ? `${(p.margen_real as number).toFixed(2)}×` : '—'}</td>
                        <td className={`px-4 py-2.5 text-right font-medium ${p.error != null ? (Math.abs(p.error as number) > 0.5 ? 'text-red-600' : 'text-green-600') : 'text-gray-400'}`}>
                          {p.error != null ? `${(p.error as number) > 0 ? '+' : ''}${(p.error as number).toFixed(3)}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right text-gray-500">{p.veces_importado as number}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
