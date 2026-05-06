'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISRubroTemplate, ISRubroTemplateCreate } from '@/types';

const EMPTY_FORM: ISRubroTemplateCreate = {
  nombre: '',
  descripcion: '',
  retailers_recomendados: [],
  outlets_recomendados: [],
  margen_minimo_verde: 2.5,
  margen_minimo_amarillo: 1.8,
  top_n_scraping_default: 50,
  dias_rotacion_esperada: undefined,
  flag_restriccion: '',
  palabras_clave_default: [],
  blacklist_default: [],
};

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState('');

  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="button" onClick={add} className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm hover:bg-gray-200">
          +
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs text-blue-700">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} className="hover:text-blue-900">×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateModal({
  initial,
  onSave,
  onClose,
  saving,
}: {
  initial?: ISRubroTemplate;
  onSave: (data: ISRubroTemplateCreate) => void;
  onClose: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<ISRubroTemplateCreate>(
    initial
      ? {
          nombre: initial.nombre,
          descripcion: initial.descripcion ?? '',
          retailers_recomendados: initial.retailers_recomendados,
          outlets_recomendados: initial.outlets_recomendados,
          margen_minimo_verde: initial.margen_minimo_verde,
          margen_minimo_amarillo: initial.margen_minimo_amarillo,
          top_n_scraping_default: initial.top_n_scraping_default,
          dias_rotacion_esperada: initial.dias_rotacion_esperada ?? undefined,
          flag_restriccion: initial.flag_restriccion ?? '',
          palabras_clave_default: initial.palabras_clave_default,
          blacklist_default: initial.blacklist_default,
        }
      : EMPTY_FORM
  );

  const set = (key: keyof ISRubroTemplateCreate, val: unknown) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-y-auto max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{initial ? 'Editar template' : 'Nuevo template'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input
              type="text"
              value={form.nombre}
              onChange={(e) => set('nombre', e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea
              value={form.descripcion ?? ''}
              onChange={(e) => set('descripcion', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Margen verde (×)</label>
              <input
                type="number"
                step="0.1"
                value={form.margen_minimo_verde}
                onChange={(e) => set('margen_minimo_verde', parseFloat(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Margen amarillo (×)</label>
              <input
                type="number"
                step="0.1"
                value={form.margen_minimo_amarillo}
                onChange={(e) => set('margen_minimo_amarillo', parseFloat(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Top N scraping</label>
              <input
                type="number"
                value={form.top_n_scraping_default}
                onChange={(e) => set('top_n_scraping_default', parseInt(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Días rotación esperada</label>
              <input
                type="number"
                value={form.dias_rotacion_esperada ?? ''}
                onChange={(e) => set('dias_rotacion_esperada', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Sin definir"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Flag restricción</label>
            <input
              type="text"
              value={form.flag_restriccion ?? ''}
              onChange={(e) => set('flag_restriccion', e.target.value || null)}
              placeholder="Ej: ENACOM"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Palabras clave (Enter para agregar)</label>
            <TagInput
              value={form.palabras_clave_default ?? []}
              onChange={(v) => set('palabras_clave_default', v)}
              placeholder="Ej: tumbler"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blacklist (Enter para agregar)</label>
            <TagInput
              value={form.blacklist_default ?? []}
              onChange={(v) => set('blacklist_default', v)}
              placeholder="Ej: refurbished"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.nombre.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : initial ? 'Guardar cambios' : 'Crear template'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const apiKey = useApiKey() || '';
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ISRubroTemplate | undefined>();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['is-templates'],
    queryFn: () => importScorerApi.getTemplates(apiKey),
    enabled: !!apiKey,
  });

  const createMutation = useMutation({
    mutationFn: (data: ISRubroTemplateCreate) => importScorerApi.createTemplate(apiKey, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-templates'] }); setShowModal(false); showToast('Template creado'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ISRubroTemplateCreate> }) =>
      importScorerApi.updateTemplate(apiKey, id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-templates'] }); setShowModal(false); setEditing(undefined); showToast('Template actualizado'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.deleteTemplate(apiKey, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-templates'] }); showToast('Template eliminado'); },
  });

  const handleSave = (data: ISRubroTemplateCreate) => {
    if (editing) {
      updateMutation.mutate({ id: editing.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleDelete = (tpl: ISRubroTemplate) => {
    if (!confirm(`¿Eliminar template "${tpl.nombre}"?`)) return;
    deleteMutation.mutate(tpl.id);
  };

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Templates de Rubros</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Base de configuración para crear rubros nuevos. Editar un template no afecta rubros existentes.
          </p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nuevo template
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
          No hay templates. Creá el primero.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setExpanded(expanded === tpl.id ? null : tpl.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 text-sm">{tpl.nombre}</span>
                    {tpl.flag_restriccion && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                        {tpl.flag_restriccion}
                      </span>
                    )}
                  </div>
                  {tpl.descripcion && (
                    <p className="text-xs text-gray-500 truncate">{tpl.descripcion}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
                  <span>Verde {tpl.margen_minimo_verde}×</span>
                  <span>Amarillo {tpl.margen_minimo_amarillo}×</span>
                  {tpl.dias_rotacion_esperada && <span>{tpl.dias_rotacion_esperada}d rot.</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditing(tpl); setShowModal(true); }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(tpl); }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  {expanded === tpl.id ? (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {expanded === tpl.id && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 text-xs space-y-2">
                  {tpl.palabras_clave_default.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-gray-500 mr-1">Palabras clave:</span>
                      {tpl.palabras_clave_default.map((k) => (
                        <span key={k} className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700">{k}</span>
                      ))}
                    </div>
                  )}
                  {tpl.blacklist_default.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-gray-500 mr-1">Blacklist:</span>
                      {tpl.blacklist_default.map((k) => (
                        <span key={k} className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">{k}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-gray-400">
                    {tpl.retailers_recomendados.length} retailers · {tpl.outlets_recomendados.length} outlets · top {tpl.top_n_scraping_default} productos
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TemplateModal
          initial={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(undefined); }}
          saving={saving}
        />
      )}
    </div>
  );
}
