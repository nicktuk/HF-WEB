'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Play, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISRubro, ISRubroCreate, ISRubroTemplate, ISRetailer, ISOutlet } from '@/types';

const PRIORIDAD_CLASS: Record<string, string> = {
  alta: 'bg-red-100 text-red-700',
  media: 'bg-yellow-100 text-yellow-700',
  baja: 'bg-gray-100 text-gray-500',
};
const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function TagInput({ label, values, onChange, placeholder }: {
  label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [input, setInput] = useState('');
  const add = () => { const t = input.trim(); if (t && !values.includes(t)) onChange([...values, t]); setInput(''); };
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <div className="flex gap-1 flex-wrap mb-1">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
            {v}<button onClick={() => onChange(values.filter((x) => x !== v))} className="text-blue-300 hover:text-blue-600">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder ?? 'Agregar y Enter'}
          className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={add} className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs hover:bg-gray-50">+</button>
      </div>
    </div>
  );
}

function RubroModal({ initial, templates, retailers, outlets, onSave, onClose, saving }: {
  initial?: ISRubro; templates: ISRubroTemplate[]; retailers: ISRetailer[]; outlets: ISOutlet[];
  onSave: (d: ISRubroCreate) => void; onClose: () => void; saving: boolean;
}) {
  const TABS = ['General', 'Mercado Libre', 'Búsqueda USA', 'Scoring'];
  const [tab, setTab] = useState(0);

  const defaultForm: ISRubroCreate = {
    nombre: '', activo: true, prioridad: 'media', frecuencia_scraping: 'diaria',
    top_n_scraping: 50, margen_minimo_verde: 2.5, margen_minimo_amarillo: 1.8,
    retailers_activos: [], palabras_busqueda_usa: [], marcas_whitelist: [], blacklist_palabras: [],
    outlets_activos: [], es_estacional: false, meses_alta_demanda: [],
  };

  const [form, setForm] = useState<ISRubroCreate>(initial ? {
    nombre: initial.nombre, template_id: initial.template_id ?? undefined,
    ml_category_id: initial.ml_category_id ?? undefined, ml_listado_url: initial.ml_listado_url ?? undefined,
    top_n_scraping: initial.top_n_scraping, filtro_vendidos_min: initial.filtro_vendidos_min ?? undefined,
    retailers_activos: initial.retailers_activos, palabras_busqueda_usa: initial.palabras_busqueda_usa,
    marcas_whitelist: initial.marcas_whitelist, blacklist_palabras: initial.blacklist_palabras,
    peso_min_kg: initial.peso_min_kg ?? undefined, peso_max_kg: initial.peso_max_kg ?? undefined,
    margen_minimo_verde: initial.margen_minimo_verde, margen_minimo_amarillo: initial.margen_minimo_amarillo,
    dias_rotacion_esperada: initial.dias_rotacion_esperada ?? undefined,
    outlets_activos: initial.outlets_activos, es_estacional: initial.es_estacional,
    meses_alta_demanda: initial.meses_alta_demanda, activo: initial.activo,
    prioridad: initial.prioridad, frecuencia_scraping: initial.frecuencia_scraping,
    flag_restriccion: initial.flag_restriccion ?? undefined, notas_internas: initial.notas_internas ?? undefined,
  } : defaultForm);

  const set = (k: keyof ISRubroCreate, v: unknown) => setForm((p) => ({ ...p, [k]: v }));
  const toggleRetailer = (slug: string) => {
    const list = form.retailers_activos ?? [];
    set('retailers_activos', list.includes(slug) ? list.filter((x) => x !== slug) : [...list, slug]);
  };
  const toggleOutlet = (id: string) => {
    const list = form.outlets_activos ?? [];
    set('outlets_activos', list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };
  const toggleMes = (m: number) => {
    const list = form.meses_alta_demanda ?? [];
    set('meses_alta_demanda', list.includes(m) ? list.filter((x) => x !== m) : [...list, m]);
  };

  const numField = (k: keyof ISRubroCreate, label: string, step = '1') => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="number" step={step} value={(form[k] as number) ?? ''}
        onChange={(e) => set(k, e.target.value ? parseFloat(e.target.value) : undefined)}
        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );
  const txtField = (k: keyof ISRubroCreate, label: string, placeholder?: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type="text" value={(form[k] as string) ?? ''} placeholder={placeholder}
        onChange={(e) => set(k, e.target.value || undefined)}
        className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl flex flex-col max-h-[92vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold">{initial ? 'Editar rubro' : 'Nuevo rubro'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="flex border-b border-gray-100 shrink-0">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${tab === i ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 0 && (
            <div className="space-y-3">
              {txtField('nombre', 'Nombre *')}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Template</label>
                <select value={form.template_id ?? ''} onChange={(e) => set('template_id', e.target.value || undefined)}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">Sin template</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Prioridad</label>
                  <select value={form.prioridad} onChange={(e) => set('prioridad', e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Frecuencia</label>
                  <select value={form.frecuencia_scraping} onChange={(e) => set('frecuencia_scraping', e.target.value as ISRubroCreate['frecuencia_scraping'])}
                    className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="diaria">Diaria</option><option value="semanal">Semanal</option><option value="manual">Manual</option>
                  </select>
                </div>
              </div>
              {txtField('flag_restriccion', 'Flag restricción (AUC, SENASA…)')}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas</label>
                <textarea value={form.notas_internas ?? ''} onChange={(e) => set('notas_internas', e.target.value || undefined)} rows={2}
                  className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} className="rounded" /> Activo
              </label>
            </div>
          )}

          {tab === 1 && (
            <div className="space-y-3">
              {txtField('ml_category_id', 'Category ID de ML (ej: MLA1051)', 'MLA1051')}
              {txtField('ml_listado_url', 'URL de listado ML (alternativa)')}
              <div className="grid grid-cols-2 gap-3">
                {numField('top_n_scraping', 'Top N productos', '10')}
                {numField('filtro_vendidos_min', 'Vendidos mínimos', '10')}
              </div>
            </div>
          )}

          {tab === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Retailers activos para este rubro</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {retailers.filter((r) => r.activo).map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-xs cursor-pointer rounded-lg border border-gray-200 px-2.5 py-1.5 hover:bg-gray-50">
                      <input type="checkbox" checked={(form.retailers_activos ?? []).includes(r.slug)}
                        onChange={() => toggleRetailer(r.slug)} className="rounded" />
                      <span className="font-medium">{r.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
              <TagInput label="Palabras de búsqueda USA" values={form.palabras_busqueda_usa ?? []}
                onChange={(v) => set('palabras_busqueda_usa', v)} placeholder="ej: kitchen mixer" />
              <TagInput label="Marcas whitelist" values={form.marcas_whitelist ?? []}
                onChange={(v) => set('marcas_whitelist', v)} placeholder="ej: KitchenAid" />
              <TagInput label="Palabras blacklist" values={form.blacklist_palabras ?? []}
                onChange={(v) => set('blacklist_palabras', v)} placeholder="ej: refurbished" />
              <div className="grid grid-cols-2 gap-3">
                {numField('peso_min_kg', 'Peso mínimo (kg)', '0.1')}
                {numField('peso_max_kg', 'Peso máximo (kg)', '0.1')}
              </div>
            </div>
          )}

          {tab === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {numField('margen_minimo_verde', 'Margen mínimo verde (×)', '0.1')}
                {numField('margen_minimo_amarillo', 'Margen mínimo amarillo (×)', '0.1')}
              </div>
              {numField('dias_rotacion_esperada', 'Días rotación esperada', '1')}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Outlets para caza física</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {outlets.filter((o) => o.activo).map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-xs cursor-pointer rounded-lg border border-gray-200 px-2.5 py-1.5 hover:bg-gray-50">
                      <input type="checkbox" checked={(form.outlets_activos ?? []).includes(o.id)}
                        onChange={() => toggleOutlet(o.id)} className="rounded" />
                      <span>{o.nombre}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs cursor-pointer mb-2">
                  <input type="checkbox" checked={form.es_estacional} onChange={(e) => set('es_estacional', e.target.checked)} className="rounded" />
                  Es estacional
                </label>
                {form.es_estacional && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Meses de alta demanda</label>
                    <div className="flex flex-wrap gap-1.5">
                      {MESES.map((m, i) => (
                        <button key={i} type="button" onClick={() => toggleMes(i + 1)}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${(form.meses_alta_demanda ?? []).includes(i + 1) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-between shrink-0">
          <div>{tab > 0 && <button onClick={() => setTab((t) => t - 1)} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">← Anterior</button>}</div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancelar</button>
            {tab < TABS.length - 1 ? (
              <button onClick={() => setTab((t) => t + 1)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">Siguiente →</button>
            ) : (
              <button onClick={() => onSave(form)} disabled={saving || !form.nombre?.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear rubro'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RubrosPage() {
  const apiKey = useApiKey() || '';
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ISRubro | undefined>();
  const [toast, setToast] = useState('');
  const [filterActivo, setFilterActivo] = useState<boolean | undefined>(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const { data: rubros = [], isLoading } = useQuery({
    queryKey: ['is-rubros', filterActivo],
    queryFn: () => importScorerApi.getRubros(apiKey, filterActivo),
    enabled: !!apiKey,
  });
  const { data: templates = [] } = useQuery({ queryKey: ['is-templates'], queryFn: () => importScorerApi.getTemplates(apiKey), enabled: !!apiKey });
  const { data: retailers = [] } = useQuery({ queryKey: ['is-retailers'], queryFn: () => importScorerApi.getRetailers(apiKey), enabled: !!apiKey });
  const { data: outlets = [] } = useQuery({ queryKey: ['is-outlets'], queryFn: () => importScorerApi.getOutlets(apiKey), enabled: !!apiKey });

  const createMutation = useMutation({
    mutationFn: (d: ISRubroCreate) => importScorerApi.createRubro(apiKey, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-rubros'] }); setShowModal(false); showToast('Rubro creado'); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<ISRubroCreate> }) => importScorerApi.updateRubro(apiKey, id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-rubros'] }); setShowModal(false); setEditing(undefined); showToast('Rubro actualizado'); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.deleteRubro(apiKey, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-rubros'] }); showToast('Rubro eliminado'); },
  });
  const scrapeMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.triggerScrapeRubro(apiKey, id),
    onSuccess: () => showToast('Scraping iniciado en background'),
  });

  const saving = createMutation.isPending || updateMutation.isPending;
  const toggleExpand = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="space-y-4">
      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Rubros</h1>
          <p className="text-sm text-gray-500 mt-0.5">Categorías configuradas para scraping y scoring.</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" /> Nuevo rubro
        </button>
      </div>

      <div className="flex gap-2">
        {[{ label: 'Activos', val: true as boolean | undefined }, { label: 'Todos', val: undefined }, { label: 'Inactivos', val: false as boolean | undefined }].map(({ label, val }) => (
          <button key={label} onClick={() => setFilterActivo(val)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterActivo === val ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 self-center">{rubros.length} rubros</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}</div>
      ) : rubros.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">No hay rubros.</div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
          {rubros.map((r) => {
            const open = expanded.has(r.id);
            return (
              <div key={r.id}>
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <button onClick={() => toggleExpand(r.id)} className="text-gray-400 hover:text-gray-600 shrink-0">
                    {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 text-sm">{r.nombre}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORIDAD_CLASS[r.prioridad]}`}>{r.prioridad}</span>
                      {!r.activo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400">Inactivo</span>}
                      {r.total_productos > 0 && (
                        <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                          <Package className="h-3 w-3" />{r.total_productos}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {r.ml_category_id && <span className="mr-2">ML: {r.ml_category_id}</span>}
                      {r.retailers_activos.length > 0 && <span>{r.retailers_activos.join(', ')}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => scrapeMutation.mutate(r.id)} title="Scrapear ahora"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600">
                      <Play className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { setEditing(r); setShowModal(true); }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => { if (!confirm(`¿Eliminar "${r.nombre}"?`)) return; deleteMutation.mutate(r.id); }}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="px-12 pb-3 pt-1 bg-gray-50 text-xs text-gray-500 space-y-1 border-t border-gray-100">
                    <div><span className="font-medium">Búsqueda USA:</span> {r.palabras_busqueda_usa.join(', ') || '—'}</div>
                    <div><span className="font-medium">Whitelist:</span> {r.marcas_whitelist.join(', ') || '—'}</div>
                    <div><span className="font-medium">Blacklist:</span> {r.blacklist_palabras.join(', ') || '—'}</div>
                    <div><span className="font-medium">Márgenes:</span> Verde ≥{r.margen_minimo_verde}× / Amarillo ≥{r.margen_minimo_amarillo}×</div>
                    {r.notas_internas && <div><span className="font-medium">Notas:</span> {r.notas_internas}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <RubroModal initial={editing} templates={templates} retailers={retailers} outlets={outlets}
          onSave={(d) => { if (editing) updateMutation.mutate({ id: editing.id, d }); else createMutation.mutate(d); }}
          onClose={() => { setShowModal(false); setEditing(undefined); }} saving={saving} />
      )}
    </div>
  );
}
