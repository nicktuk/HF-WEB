'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, MapPin, Store } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISOutlet, ISOutletCreate } from '@/types';

const EMPTY: ISOutletCreate = {
  nombre: '', tipo: 'tienda', ciudad: '', estado: '', direccion: '',
  rubros_tipicos: [], activo: true, fee_agencia_usd: 50,
};

function TagInput({ label, values, onChange }: { label: string; values: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState('');
  const add = () => { const t = input.trim(); if (t && !values.includes(t)) onChange([...values, t]); setInput(''); };
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="flex gap-1.5 flex-wrap mb-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            {v}<button onClick={() => onChange(values.filter((x) => x !== v))} className="text-blue-400 hover:text-blue-700">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder="Agregar y Enter"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={add} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">+</button>
      </div>
    </div>
  );
}

function OutletModal({ initial, onSave, onClose, saving }: {
  initial?: ISOutlet; onSave: (d: ISOutletCreate) => void; onClose: () => void; saving: boolean;
}) {
  const [form, setForm] = useState<ISOutletCreate>(
    initial ? {
      nombre: initial.nombre, tipo: initial.tipo, ciudad: initial.ciudad,
      estado: initial.estado, direccion: initial.direccion ?? '',
      rubros_tipicos: initial.rubros_tipicos, activo: initial.activo,
      fee_agencia_usd: initial.fee_agencia_usd, notas_internas: initial.notas_internas ?? '',
    } : EMPTY
  );
  const set = (k: keyof ISOutletCreate, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? 'Editar outlet' : 'Nuevo outlet'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input type="text" value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select value={form.tipo} onChange={(e) => set('tipo', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="tienda">Tienda outlet</option>
                <option value="mall_outlet">Mall outlet</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad *</label>
              <input type="text" value={form.ciudad} onChange={(e) => set('ciudad', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Estado (FL, NY…) *</label>
              <input type="text" value={form.estado} onChange={(e) => set('estado', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
            <input type="text" value={form.direccion ?? ''} onChange={(e) => set('direccion', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fee agencia USD</label>
              <input type="number" step="5" value={form.fee_agencia_usd}
                onChange={(e) => set('fee_agencia_usd', parseFloat(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} className="rounded" />
                Activo
              </label>
            </div>
          </div>
          <TagInput label="Rubros típicos" values={form.rubros_tipicos ?? []}
            onChange={(v) => set('rubros_tipicos', v)} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
            <textarea value={form.notas_internas ?? ''} onChange={(e) => set('notas_internas', e.target.value)} rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={() => onSave(form)}
            disabled={saving || !form.nombre.trim() || !form.ciudad.trim() || !form.estado.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear outlet'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OutletsPage() {
  const apiKey = useApiKey() || '';
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ISOutlet | undefined>();
  const [toast, setToast] = useState('');
  const [filterActivo, setFilterActivo] = useState<boolean | undefined>(undefined);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ['is-outlets', filterActivo],
    queryFn: () => importScorerApi.getOutlets(apiKey, filterActivo),
    enabled: !!apiKey,
  });

  const createMutation = useMutation({
    mutationFn: (d: ISOutletCreate) => importScorerApi.createOutlet(apiKey, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-outlets'] }); setShowModal(false); showToast('Outlet creado'); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<ISOutletCreate> }) => importScorerApi.updateOutlet(apiKey, id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-outlets'] }); setShowModal(false); setEditing(undefined); showToast('Outlet actualizado'); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.deleteOutlet(apiKey, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-outlets'] }); showToast('Outlet eliminado'); },
  });

  const saving = createMutation.isPending || updateMutation.isPending;
  const handleSave = (d: ISOutletCreate) => {
    if (editing) updateMutation.mutate({ id: editing.id, d });
    else createMutation.mutate(d);
  };

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Outlets físicos USA</h1>
          <p className="text-sm text-gray-500 mt-0.5">TJ Maxx, Marshalls, HomeGoods y otros outlets para compra física.</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nuevo outlet
        </button>
      </div>

      <div className="flex gap-2">
        {[{ label: 'Todos', val: undefined }, { label: 'Activos', val: true }, { label: 'Inactivos', val: false }].map(({ label, val }) => (
          <button key={label} onClick={() => setFilterActivo(val)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterActivo === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">{outlets.length} outlets</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : outlets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">No hay outlets.</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
          {outlets.map((o) => (
            <div key={o.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <Store className="h-5 w-5 text-gray-300 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">{o.nombre}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{o.tipo === 'mall_outlet' ? 'Mall' : 'Tienda'}</span>
                  {!o.activo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">Inactivo</span>}
                  {o.efectividad_historica != null && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">{(o.efectividad_historica * 100).toFixed(0)}% efectividad</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{o.ciudad}, {o.estado}</span>
                  <span>Fee: ${o.fee_agencia_usd}</span>
                  {o.visitas_pasadas > 0 && <span>{o.visitas_pasadas} visitas</span>}
                  {o.rubros_tipicos.length > 0 && <span>{o.rubros_tipicos.slice(0, 3).join(', ')}{o.rubros_tipicos.length > 3 ? '…' : ''}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => { setEditing(o); setShowModal(true); }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => { if (!confirm(`¿Eliminar "${o.nombre}"?`)) return; deleteMutation.mutate(o.id); }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <OutletModal initial={editing} onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(undefined); }} saving={saving} />
      )}
    </div>
  );
}
