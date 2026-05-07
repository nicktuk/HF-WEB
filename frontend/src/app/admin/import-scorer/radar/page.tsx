'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { RefreshCw, TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISTrendSnapshot } from '@/types';

const TENDENCIA_CONFIG = {
  subiendo:  { label: 'Subiendo',   icon: TrendingUp,   cls: 'text-green-600 bg-green-50'  },
  bajando:   { label: 'Bajando',    icon: TrendingDown, cls: 'text-red-500 bg-red-50'      },
  estable:   { label: 'Estable',    icon: Minus,        cls: 'text-gray-500 bg-gray-100'   },
  sin_datos: { label: 'Sin datos',  icon: AlertCircle,  cls: 'text-gray-300 bg-gray-50'    },
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length === 0) return <div className="h-10 w-full bg-gray-50 rounded" />;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px h-10 w-full">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${color}`}
          style={{ height: `${Math.max(2, (v / max) * 100)}%`, opacity: 0.6 + 0.4 * (v / max) }}
        />
      ))}
    </div>
  );
}

function TendenciaBadge({ t }: { t: ISTrendSnapshot['tendencia_ar'] }) {
  const cfg = TENDENCIA_CONFIG[t] ?? TENDENCIA_CONFIG.sin_datos;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      <Icon className="h-3 w-3" /> {cfg.label}
    </span>
  );
}

function RadarCard({ snap, onActualizar, actualizando }: {
  snap: ISTrendSnapshot;
  onActualizar: () => void;
  actualizando: boolean;
}) {
  const oportunidad = snap.tendencia_usa === 'subiendo' && snap.tendencia_ar !== 'subiendo';

  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${oportunidad ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'}`}>
      <div className="px-4 py-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-gray-900 text-sm">{snap.rubro_nombre}</span>
            {snap.keyword && <span className="text-xs text-gray-400">"{snap.keyword}"</span>}
            {oportunidad && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Oportunidad
              </span>
            )}
          </div>
          {snap.updated_at && (
            <div className="text-xs text-gray-400 mt-0.5">
              Actualizado {new Date(snap.updated_at).toLocaleDateString('es-AR')}
            </div>
          )}
        </div>
        <button onClick={onActualizar} disabled={actualizando}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 disabled:opacity-40">
          <RefreshCw className={`h-3.5 w-3.5 ${actualizando ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100">
        {/* Argentina */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">Argentina</span>
            <TendenciaBadge t={snap.tendencia_ar} />
          </div>
          <Sparkline data={snap.data_ar} color="bg-blue-400" />
          {snap.score_ar != null && (
            <div className="mt-1 text-right text-xs text-gray-400">Score: {snap.score_ar}</div>
          )}
        </div>

        {/* USA */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500">USA</span>
            <TendenciaBadge t={snap.tendencia_usa} />
          </div>
          <Sparkline data={snap.data_usa} color="bg-violet-400" />
          {snap.score_usa != null && (
            <div className="mt-1 text-right text-xs text-gray-400">Score: {snap.score_usa}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RadarPage() {
  const apiKey = useApiKey() || '';
  const [tab, setTab] = useState<'todos' | 'oportunidades'>('todos');
  const [toast, setToast] = useState('');
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const { data: snapshots = [], isLoading, refetch } = useQuery({
    queryKey: ['is-radar'],
    queryFn: () => importScorerApi.getRadar(apiKey),
    enabled: !!apiKey,
  });

  const actualizarMutation = useMutation({
    mutationFn: () => importScorerApi.actualizarRadar(apiKey),
    onSuccess: () => { refetch(); showToast('Radar actualizado'); },
  });

  const actualizarRubroMutation = useMutation({
    mutationFn: (rubroId: string) => importScorerApi.actualizarRadarRubro(apiKey, rubroId),
    onSuccess: () => { refetch(); setActualizandoId(null); },
    onSettled: () => setActualizandoId(null),
  });

  const lista = tab === 'oportunidades'
    ? snapshots.filter((s) => s.tendencia_usa === 'subiendo' && s.tendencia_ar !== 'subiendo')
    : snapshots;

  const nOportunidades = snapshots.filter((s) => s.tendencia_usa === 'subiendo' && s.tendencia_ar !== 'subiendo').length;

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Radar</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tendencias en Argentina y USA por rubro. Actualización: Google Trends (últimos 3 meses).
          </p>
        </div>
        <button onClick={() => actualizarMutation.mutate()} disabled={actualizarMutation.isPending}
          className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${actualizarMutation.isPending ? 'animate-spin' : ''}`} />
          Actualizar radar
        </button>
      </div>

      {/* Referencia de colores */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-400 inline-block" /> Argentina</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-violet-400 inline-block" /> USA</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-amber-100 border border-amber-300 inline-block" /> Oportunidad: sube en USA, no en AR</span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button onClick={() => setTab('todos')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'todos' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Todos ({snapshots.length})
        </button>
        <button onClick={() => setTab('oportunidades')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'oportunidades' ? 'border-amber-500 text-amber-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          Oportunidades {nOportunidades > 0 && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-amber-700">{nOportunidades}</span>}
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1,2,3,4].map((i) => <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-400">
          {tab === 'oportunidades'
            ? 'No hay oportunidades detectadas ahora.'
            : 'No hay datos de radar. Configurá rubros con keywords y presioná "Actualizar radar".'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {lista.map((snap) => (
            <RadarCard
              key={snap.rubro_id}
              snap={snap}
              actualizando={actualizandoId === snap.rubro_id}
              onActualizar={() => {
                setActualizandoId(snap.rubro_id);
                actualizarRubroMutation.mutate(snap.rubro_id);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
