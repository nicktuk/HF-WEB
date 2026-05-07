'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Pencil, Store } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISListaCaza } from '@/types';

const ESTADO_COLORS: Record<string, string> = {
  pendiente:   'bg-gray-100 text-gray-600',
  en_progreso: 'bg-blue-100 text-blue-700',
  completada:  'bg-green-100 text-green-700',
  cancelada:   'bg-red-100 text-red-700',
};

const ESTADOS = ['pendiente', 'en_progreso', 'completada', 'cancelada'];

export default function ListasCazaPage() {
  const apiKey = useApiKey() || '';
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNota, setEditNota] = useState('');
  const [editEstado, setEditEstado] = useState('');
  const [toast, setToast] = useState('');
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const { data: listas = [], isLoading } = useQuery({
    queryKey: ['is-listas-caza'],
    queryFn: () => importScorerApi.getListasCaza(apiKey),
    enabled: !!apiKey,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ISListaCaza> }) =>
      importScorerApi.updateListaCaza(apiKey, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-listas-caza'] }); setEditingId(null); showToast('Lista actualizada'); },
  });

  const startEdit = (l: ISListaCaza) => {
    setEditingId(l.id);
    setEditNota(l.notas_agencia ?? '');
    setEditEstado(l.estado);
  };

  const pdfUrl = (id: string) => `${importScorerApi.exportListaCazaPdfUrl(id)}`;

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Listas de caza</h1>
        <p className="text-sm text-gray-500 mt-0.5">Listas generadas desde carritos para compra física en outlets.</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : (listas as ISListaCaza[]).length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-12 text-center text-sm text-gray-400">
          <Store className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          No hay listas de caza. Generá una desde un carrito que tenga ítems en modo outlet.
        </div>
      ) : (
        <div className="space-y-3">
          {(listas as ISListaCaza[]).map((l) => (
            <div key={l.id} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">Lista #{l.id.slice(0, 8)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLORS[l.estado]}`}>{l.estado}</span>
                    <span className="text-xs text-gray-400">{new Date(l.fecha).toLocaleDateString('es-AR')}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {l.productos.length} productos · Total estimado: USD ${l.total_estimado_usd.toFixed(2)}
                    {l.fee_agencia_usd != null && ` · Fee agencia: $${l.fee_agencia_usd}`}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a href={pdfUrl(l.id)} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                    <Download className="h-3.5 w-3.5" /> PDF
                  </a>
                  <button onClick={() => startEdit(l)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Productos */}
              {l.productos.length > 0 && (
                <div className="border-t border-gray-100 px-5 py-3">
                  <div className="text-xs font-medium text-gray-500 mb-2">Productos</div>
                  <div className="space-y-1">
                    {l.productos.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className="w-5 text-gray-400 text-right">{i + 1}.</span>
                        <span className="flex-1 truncate">{(p as Record<string, unknown>).nombre as string}</span>
                        <span className="text-gray-400">×{(p as Record<string, unknown>).cantidad as number}</span>
                        <span className="font-medium">${((p as Record<string, unknown>).precio_objetivo_usd as number)?.toFixed(2)}</span>
                        <span className="text-gray-400">{((p as Record<string, unknown>).peso_kg as number)?.toFixed(1)} kg</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Edit inline */}
              {editingId === l.id && (
                <div className="border-t border-gray-100 px-5 py-3 bg-gray-50 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Estado</label>
                      <select value={editEstado} onChange={(e) => setEditEstado(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {ESTADOS.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Notas agencia</label>
                      <input type="text" value={editNota} onChange={(e) => setEditNota(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setEditingId(null)} className="rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100">Cancelar</button>
                    <button onClick={() => updateMutation.mutate({ id: l.id, data: { estado: editEstado, notas_agencia: editNota } })}
                      disabled={updateMutation.isPending}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                      {updateMutation.isPending ? 'Guardando…' : 'Guardar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
