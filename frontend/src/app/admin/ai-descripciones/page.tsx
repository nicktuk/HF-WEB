'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Play, Square, RotateCcw, CheckCircle, XCircle, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiKey } from '@/hooks/useAuth';
import { aiApi, AIStats, AIJobStatus } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── helpers ────────────────────────────────────────────────────────────────

function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}

function etaStr(processed: number, total: number, startMs: number) {
  if (!processed || processed >= total) return '';
  const elapsed = (Date.now() - startMs) / 1000;
  const rate = processed / elapsed;          // productos/s
  const remaining = (total - processed) / rate;
  if (remaining < 60) return `~${Math.round(remaining)}s`;
  return `~${Math.round(remaining / 60)}min`;
}

// ─── tipos locales ───────────────────────────────────────────────────────────

type Mode = 'pending' | 'category' | 'all';
type Provider = 'claude' | 'openai';

// ─── componente principal ────────────────────────────────────────────────────

export default function AIDescripcionesPage() {
  const apiKey = useApiKey() || '';

  const [stats, setStats] = useState<AIStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Config
  const [provider, setProvider] = useState<Provider>('claude');
  const [useSearch, setUseSearch] = useState(true);
  const [useVision, setUseVision] = useState(true);
  const [useRefetch, setUseRefetch] = useState(true);
  const [useImageSearch, setUseImageSearch] = useState(false);
  const [mode, setMode] = useState<Mode>('pending');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [forceRegenerate, setForceRegenerate] = useState(false);

  // Job
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<AIJobStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const startMs = useRef<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── cargar stats ─────────────────────────────────────────────────────────

  const loadStats = async () => {
    if (!apiKey) return;
    try {
      const s = await aiApi.getStats(apiKey);
      setStats(s);
      // Sincronizar proveedor con lo que dice el backend
      setProvider(s.ai_provider as Provider);
    } catch {/* ignore */}
    finally { setLoadingStats(false); }
  };

  useEffect(() => { void loadStats(); }, [apiKey]);

  // ── polling del job activo ───────────────────────────────────────────────

  useEffect(() => {
    if (!jobId || !apiKey) return;
    const poll = async () => {
      try {
        const status = await aiApi.getJob(apiKey, jobId);
        setJob(status);
        if (status.status !== 'running') {
          if (pollRef.current) clearInterval(pollRef.current);
          void loadStats();  // refrescar cobertura al terminar
        }
      } catch {/* ignore */}
    };
    void poll();
    pollRef.current = setInterval(poll, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, apiKey]);

  // ── lanzar job ────────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!apiKey) return;
    setStarting(true);
    try {
      const res = await aiApi.generate(apiKey, {
        mode,
        category_id: mode === 'category' ? (categoryId ?? undefined) : undefined,
        force_regenerate: forceRegenerate,
        use_search: useSearch,
        use_vision: useVision,
        use_source_refetch: useRefetch,
        use_image_search: useImageSearch,
      });
      startMs.current = Date.now();
      setJobId(res.job_id);
      setJob(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al iniciar');
    } finally {
      setStarting(false);
    }
  };

  const handleCancel = async () => {
    if (!apiKey || !jobId) return;
    await aiApi.cancelJob(apiKey, jobId).catch(() => {});
    if (pollRef.current) clearInterval(pollRef.current);
    setJob((prev) => prev ? { ...prev, status: 'cancelled' } : prev);
  };

  const handleReset = () => {
    setJobId(null);
    setJob(null);
  };

  // ── categorías ordenadas por pendientes ─────────────────────────────────

  const sortedCategories = useMemo(
    () => (stats?.categories ?? []).slice().sort((a, b) => b.pending - a.pending),
    [stats],
  );

  const isRunning = job?.status === 'running';

  // ─── render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="h-7 w-7 text-violet-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Descripciones IA</h1>
          <p className="text-sm text-gray-500">
            Generá descripciones cortas para los productos activos usando inteligencia artificial.
          </p>
        </div>
      </div>

      {/* Tarjetas de cobertura */}
      {loadingStats ? (
        <div className="text-sm text-gray-500">Cargando estadísticas...</div>
      ) : stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Activos" value={stats.total_enabled} color="gray" />
          <StatCard label="Con descripción" value={stats.with_description} color="green" />
          <StatCard label="Sin descripción" value={stats.without_description} color="amber" />
          <StatCard
            label="Cobertura"
            value={`${pct(stats.with_description, stats.total_enabled)}%`}
            color="violet"
          />
        </div>
      )}

      {/* Panel de configuración + acción */}
      {!jobId && (
        <div className="border rounded-xl bg-white p-5 space-y-5">
          <h2 className="font-semibold text-gray-900">Configuración</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Proveedor */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor IA</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as Provider)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="claude">Claude (Anthropic)</option>
                <option value="openai">GPT-4o mini (OpenAI)</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Proveedor activo: <strong>{stats?.ai_provider ?? '—'}</strong>. Cambiable en .env
              </p>
            </div>

            {/* Modo */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Alcance</label>
              <select
                value={mode}
                onChange={(e) => { setMode(e.target.value as Mode); setCategoryId(null); }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="pending">Solo pendientes (sin descripción)</option>
                <option value="category">Por categoría</option>
                <option value="all">Todos los activos</option>
              </select>
            </div>

            {/* Selector de categoría */}
            {mode === 'category' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Categoría</label>
                <select
                  value={categoryId ?? ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">— elegir categoría —</option>
                  {sortedCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.pending} pendientes / {c.total} total)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Opciones de enriquecimiento */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Enriquecimiento del contexto</p>
            <div className="flex flex-wrap gap-4">
              <Toggle value={useSearch} onChange={setUseSearch} label="Búsqueda web (Brave)" />
              <Toggle value={useVision} onChange={setUseVision} label="Análisis de imagen" />
              <Toggle value={useRefetch} onChange={setUseRefetch} label="Re-fetch URL origen" />
              <Toggle value={useImageSearch} onChange={setUseImageSearch} label="Buscar imágenes (solo sin fotos)" />
            </div>
          </div>

          {/* Force regenerate */}
          {mode !== 'pending' && (
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={forceRegenerate}
                onChange={(e) => setForceRegenerate(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-violet-600"
              />
              Forzar re-generación (sobreescribir las que ya tienen descripción)
            </label>
          )}

          <Button
            onClick={() => void handleStart()}
            isLoading={starting}
            disabled={starting || (mode === 'category' && !categoryId)}
            className="bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Generar descripciones
          </Button>
        </div>
      )}

      {/* Progreso del job */}
      {jobId && job && (
        <div className="border rounded-xl bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isRunning
                ? <Loader2 className="h-5 w-5 text-violet-600 animate-spin" />
                : job.status === 'completed'
                  ? <CheckCircle className="h-5 w-5 text-emerald-600" />
                  : <XCircle className="h-5 w-5 text-red-500" />
              }
              <span className="font-semibold text-gray-900 capitalize">{
                isRunning ? 'Procesando...'
                : job.status === 'completed' ? 'Completado'
                : 'Cancelado'
              }</span>
            </div>
            <div className="flex items-center gap-2">
              {isRunning && (
                <Button size="sm" variant="outline" onClick={() => void handleCancel()}>
                  <Square className="h-3.5 w-3.5 mr-1" />
                  Cancelar
                </Button>
              )}
              {!isRunning && (
                <Button size="sm" variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                  Nueva generación
                </Button>
              )}
            </div>
          </div>

          {/* Barra de progreso */}
          <div>
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{job.processed} / {job.total} productos</span>
              <span className="flex gap-3">
                <span className="text-emerald-600">✓ {job.success}</span>
                {job.failed > 0 && <span className="text-red-500">✗ {job.failed}</span>}
                {isRunning && startMs.current > 0 && (
                  <span>{etaStr(job.processed, job.total, startMs.current)}</span>
                )}
              </span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  job.status === 'completed' ? 'bg-emerald-500'
                  : job.status === 'cancelled' ? 'bg-gray-400'
                  : 'bg-violet-500'
                )}
                style={{ width: `${job.progress_pct}%` }}
              />
            </div>
          </div>

          {/* Log de resultados */}
          {job.results.length > 0 && (
            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y text-sm">
              {job.results.map((r) => (
                <div key={r.id} className="px-3 py-2">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <span className="font-medium text-gray-800 line-clamp-1">{r.name}</span>
                      <p className="text-gray-500 text-xs line-clamp-2">{r.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Errores */}
          {job.errors.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-red-600 font-medium">
                {job.errors.length} error{job.errors.length !== 1 ? 'es' : ''}
              </summary>
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg divide-y">
                {job.errors.map((e, i) => (
                  <div key={i} className="px-3 py-1.5 flex items-start gap-2">
                    <XCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 text-xs">
                      <span className="font-medium text-gray-700">{e.name}</span>
                      <span className="text-gray-400"> — {e.error}</span>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Tabla de cobertura por categoría */}
      {stats && sortedCategories.length > 0 && (
        <div className="border rounded-xl bg-white overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-gray-900 text-sm">Cobertura por categoría</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Con desc.</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pendientes</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase w-40">Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedCategories.map((c) => {
                  const p = pct(c.with_desc, c.total);
                  return (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-900 font-medium">{c.name}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{c.total}</td>
                      <td className="px-4 py-2 text-right text-emerald-600">{c.with_desc}</td>
                      <td className="px-4 py-2 text-right text-amber-600">{c.pending}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${p}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 w-8 text-right">{p}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponentes ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: 'gray' | 'green' | 'amber' | 'violet';
}) {
  const colors = {
    gray:   'bg-gray-50  border-gray-200  text-gray-700',
    green:  'bg-emerald-50 border-emerald-200 text-emerald-700',
    amber:  'bg-amber-50  border-amber-200  text-amber-700',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
  };
  return (
    <div className={cn('border rounded-xl p-4', colors[color])}>
      <p className="text-xs font-medium uppercase opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-violet-600"
      />
      {label}
    </label>
  );
}
