'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Pause, Play, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISRetailer, ISRetailerCreate } from '@/types';

const EMPTY_FORM: ISRetailerCreate = {
  nombre: '',
  slug: '',
  tipo: 'online',
  base_url: '',
  search_url_template: '',
  scraper_implementacion: '',
  requiere_auth: false,
  cobra_tax_fl: true,
  envio_gratis_umbral: undefined,
  delay_min_ms: 2000,
  delay_max_ms: 5000,
  requiere_stealth: true,
  activo: true,
};

function RetailerModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: ISRetailer;
  onSave: (data: ISRetailerCreate) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ISRetailerCreate>(
    initial
      ? {
          nombre: initial.nombre,
          slug: initial.slug,
          tipo: initial.tipo,
          base_url: initial.base_url,
          search_url_template: initial.search_url_template,
          scraper_implementacion: initial.scraper_implementacion,
          requiere_auth: initial.requiere_auth,
          cobra_tax_fl: initial.cobra_tax_fl,
          envio_gratis_umbral: initial.envio_gratis_umbral ?? undefined,
          delay_min_ms: initial.delay_min_ms,
          delay_max_ms: initial.delay_max_ms,
          requiere_stealth: initial.requiere_stealth,
          activo: initial.activo,
        }
      : EMPTY_FORM
  );

  const set = (key: keyof ISRetailerCreate, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const autoSlug = (nombre: string) =>
    nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? 'Editar retailer' : 'Nuevo retailer'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => {
                  set('nombre', e.target.value);
                  if (!initial) set('slug', autoSlug(e.target.value));
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
                disabled={!!initial}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
              <select
                value={form.tipo}
                onChange={(e) => set('tipo', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="online">Solo online</option>
                <option value="ambos">Online y físico</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Scraper implementación</label>
              <input
                type="text"
                value={form.scraper_implementacion ?? ''}
                onChange={(e) => set('scraper_implementacion', e.target.value)}
                placeholder="Ej: walmart (debe existir en /scrapers)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL *</label>
            <input
              type="url"
              value={form.base_url}
              onChange={(e) => set('base_url', e.target.value)}
              placeholder="https://www.walmart.com"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search URL template *</label>
            <input
              type="text"
              value={form.search_url_template}
              onChange={(e) => set('search_url_template', e.target.value)}
              placeholder="https://www.walmart.com/search?q={query}"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Usar {'{query}'} como placeholder del término de búsqueda</p>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay min (ms)</label>
              <input
                type="number"
                value={form.delay_min_ms}
                onChange={(e) => set('delay_min_ms', parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Delay max (ms)</label>
              <input
                type="number"
                value={form.delay_max_ms}
                onChange={(e) => set('delay_max_ms', parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Envío gratis desde USD</label>
              <input
                type="number"
                value={form.envio_gratis_umbral ?? ''}
                onChange={(e) => set('envio_gratis_umbral', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Sin umbral"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {[
              { key: 'cobra_tax_fl', label: 'Cobra tax FL (7%)' },
              { key: 'requiere_auth', label: 'Requiere autenticación' },
              { key: 'requiere_stealth', label: 'Requiere stealth' },
              { key: 'activo', label: 'Activo' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!form[key as keyof ISRetailerCreate]}
                  onChange={(e) => set(key as keyof ISRetailerCreate, e.target.checked)}
                  className="rounded border-gray-300"
                />
                {label}
              </label>
            ))}
          </div>

          {!initial && !form.scraper_implementacion && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
              Sin scraper implementado, el retailer se creará pero no participará en scraping automático.
              Podés agregarlo después implementando <code>/app/scrapers/import_scorer/{form.slug || 'slug'}.py</code>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.nombre.trim() || !form.slug.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear retailer'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScraperBadge({ disponible }: { disponible: boolean }) {
  if (disponible) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
        <CheckCircle className="h-3 w-3" /> Scraper OK
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
      <AlertCircle className="h-3 w-3" /> Sin scraper
    </span>
  );
}

export default function RetailersPage() {
  const apiKey = useApiKey() || '';
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ISRetailer | undefined>();
  const [toast, setToast] = useState('');
  const [filterActivo, setFilterActivo] = useState<boolean | undefined>(undefined);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const { data: retailers = [], isLoading } = useQuery({
    queryKey: ['is-retailers', filterActivo],
    queryFn: () => importScorerApi.getRetailers(apiKey, filterActivo),
    enabled: !!apiKey,
  });

  const createMutation = useMutation({
    mutationFn: (data: ISRetailerCreate) => importScorerApi.createRetailer(apiKey, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-retailers'] }); setShowModal(false); showToast('Retailer creado'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ISRetailerCreate> }) =>
      importScorerApi.updateRetailer(apiKey, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-retailers'] }); setShowModal(false); setEditing(undefined); showToast('Retailer actualizado'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.deleteRetailer(apiKey, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-retailers'] }); showToast('Retailer eliminado'); },
  });

  const pausarMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.pausarRetailer(apiKey, id, 6),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-retailers'] }); showToast('Retailer pausado 6h'); },
  });

  const reactivarMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.reactivarRetailer(apiKey, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-retailers'] }); showToast('Retailer reactivado'); },
  });

  const handleSave = (data: ISRetailerCreate) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const saving = createMutation.isPending || updateMutation.isPending;
  const isPaused = (r: ISRetailer) => r.pausado_hasta && new Date(r.pausado_hasta) > new Date();

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Retailers USA</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tiendas online de EE.UU. donde se buscan productos.
          </p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo retailer
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        {[
          { label: 'Todos', val: undefined },
          { label: 'Activos', val: true },
          { label: 'Inactivos', val: false },
        ].map(({ label, val }) => (
          <button
            key={label}
            onClick={() => setFilterActivo(val)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filterActivo === val
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">{retailers.length} retailers</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : retailers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          No hay retailers.
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
          {retailers.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 text-sm">{r.nombre}</span>
                  <span className="text-xs text-gray-400 font-mono">{r.slug}</span>
                  <ScraperBadge disponible={r.scraper_disponible} />
                  {isPaused(r) && (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                      Pausado hasta {new Date(r.pausado_hasta!).toLocaleString('es-AR')}
                    </span>
                  )}
                  {!r.activo && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Inactivo</span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                  <span>{r.tipo}</span>
                  {r.cobra_tax_fl && <span>Tax FL 7%</span>}
                  {r.envio_gratis_umbral && <span>Free ship +${r.envio_gratis_umbral}</span>}
                  {r.veces_usado > 0 && <span>{r.veces_usado} usos</span>}
                  {r.margen_real_promedio && <span>Margen real: {r.margen_real_promedio.toFixed(1)}×</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isPaused(r) ? (
                  <button
                    onClick={() => reactivarMutation.mutate(r.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600"
                    title="Reactivar"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => pausarMutation.mutate(r.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-orange-50 hover:text-orange-600"
                    title="Pausar 6h"
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => { setEditing(r); setShowModal(true); }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (!confirm(`¿Eliminar retailer "${r.nombre}"?`)) return;
                    deleteMutation.mutate(r.id);
                  }}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RetailerModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          saving={saving}
        />
      )}
    </div>
  );
}
