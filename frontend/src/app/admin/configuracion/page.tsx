'use client';

import { useEffect, useState } from 'react';
import { Settings2, Save, Eye, EyeOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiKey } from '@/hooks/useAuth';
import { settingsApi, adminApi, AISettingsResponse } from '@/lib/api';

// ─── PasswordInput ────────────────────────────────────────────────────────────

function PasswordInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '••••••••'}
        disabled={disabled}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        tabIndex={-1}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConfiguracionPage() {
  const apiKey = useApiKey() || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Catalog settings
  const [stockThreshold, setStockThreshold] = useState('5');
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [showBySections, setShowBySections] = useState(false);
  const [savingShowBySections, setSavingShowBySections] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [savingGroupByCategory, setSavingGroupByCategory] = useState(false);

  // Valores originales (enmascarados) que llegaron del servidor
  const [original, setOriginal] = useState<AISettingsResponse | null>(null);

  // Estado del formulario
  const [provider, setProvider] = useState('claude');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [braveKey, setBraveKey] = useState('');
  const [batchConcurrency, setBatchConcurrency] = useState(5);
  const [promptExtra, setPromptExtra] = useState('');

  // ── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    adminApi.getCatalogSettings(apiKey)
      .then((data) => {
        setStockThreshold(String(data.stock_low_threshold ?? 5));
        setShowBySections(data.show_by_sections ?? false);
        setGroupByCategory(data.group_by_category ?? true);
      })
      .catch(() => {});
    settingsApi
      .getAI(apiKey)
      .then((data) => {
        setOriginal(data);
        setProvider(data.provider);
        setAnthropicKey(data.anthropic_key);
        setOpenaiKey(data.openai_key);
        setBraveKey(data.brave_key);
        setBatchConcurrency(data.batch_concurrency);
        setPromptExtra(data.prompt_extra);
      })
      .catch(() => showToast('error', 'No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, [apiKey]);

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  // ── Guardar ────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await settingsApi.updateAI(apiKey, {
        provider,
        anthropic_key: anthropicKey,
        openai_key: openaiKey,
        brave_key: braveKey,
        batch_concurrency: batchConcurrency,
        prompt_extra: promptExtra,
      });
      setOriginal(updated);
      setProvider(updated.provider);
      setAnthropicKey(updated.anthropic_key);
      setOpenaiKey(updated.openai_key);
      setBraveKey(updated.brave_key);
      setBatchConcurrency(updated.batch_concurrency);
      setPromptExtra(updated.prompt_extra);
      showToast('success', 'Configuración guardada correctamente');
    } catch {
      showToast('error', 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveThreshold() {
    setSavingThreshold(true);
    try {
      await adminApi.updateCatalogSettings(apiKey, { stock_low_threshold: Number(stockThreshold) });
      setThresholdSaved(true);
      setTimeout(() => setThresholdSaved(false), 2000);
    } catch {
      showToast('error', 'Error al guardar el umbral');
    } finally {
      setSavingThreshold(false);
    }
  }

  async function handleToggleShowBySections(value: boolean) {
    setSavingShowBySections(true);
    try {
      const updated = await adminApi.updateCatalogSettings(apiKey, { show_by_sections: value });
      setShowBySections(updated.show_by_sections);
    } catch {
      showToast('error', 'Error al guardar la configuración');
    } finally {
      setSavingShowBySections(false);
    }
  }

  async function handleToggleGroupByCategory(value: boolean) {
    setSavingGroupByCategory(true);
    try {
      const updated = await adminApi.updateCatalogSettings(apiKey, { group_by_category: value });
      setGroupByCategory(updated.group_by_category);
    } catch {
      showToast('error', 'Error al guardar la configuración');
    } finally {
      setSavingGroupByCategory(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings2 className="h-6 w-6 text-gray-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Configuracion IA</h1>
          <p className="text-sm text-gray-500">
            Las claves guardadas aqui tienen prioridad sobre el archivo .env del servidor.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="h-4 w-4 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0" />
          )}
          {toast.message}
        </div>
      )}

      {/* Form card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Proveedor de IA</h2>
        </div>
        <div className="space-y-5 px-6 py-5">
          {/* Provider selector */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Proveedor activo</label>
            <div className="flex gap-3">
              {(['claude', 'openai'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    provider === p
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p === 'claude' ? 'Claude (Anthropic)' : 'OpenAI'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* API Keys card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Claves de API</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Deja el campo sin modificar para conservar la clave actual. Las claves se muestran enmascaradas por seguridad.
          </p>
        </div>
        <div className="space-y-5 px-6 py-5">
          {/* Anthropic */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Anthropic API Key
              <span className="ml-2 text-xs font-normal text-gray-400">(Claude)</span>
            </label>
            <PasswordInput
              value={anthropicKey}
              onChange={setAnthropicKey}
              placeholder="sk-ant-..."
            />
          </div>

          {/* OpenAI */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              OpenAI API Key
            </label>
            <PasswordInput
              value={openaiKey}
              onChange={setOpenaiKey}
              placeholder="sk-..."
            />
          </div>

          {/* Brave */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Brave Search API Key
              <span className="ml-2 text-xs font-normal text-gray-400">(búsqueda web)</span>
            </label>
            <PasswordInput
              value={braveKey}
              onChange={setBraveKey}
              placeholder="BSA..."
            />
          </div>
        </div>
      </div>

      {/* Batch config card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Configuracion del batch</h2>
        </div>
        <div className="px-6 py-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Concurrencia del batch
              <span className="ml-2 text-xs font-normal text-gray-400">
                (cuantos productos procesar en paralelo)
              </span>
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={batchConcurrency}
              onChange={(e) => setBatchConcurrency(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-32 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Prompt extra card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Instrucciones para el generador</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Se agregan al prompt base. Escribí en lenguaje natural, una instrucción por línea.
          </p>
        </div>
        <div className="px-6 py-5">
          <textarea
            value={promptExtra}
            onChange={(e) => setPromptExtra(e.target.value)}
            rows={7}
            placeholder={
              'Ejemplos:\n' +
              '- Evitá palabras como "increíble", "revolucionario", "de última generación"\n' +
              '- La tienda se llama Hefa Productos, mencionála en el cierre si encaja natural\n' +
              '- Siempre destacá si el producto incluye garantía oficial\n' +
              '- Usá vos (voseo) siempre, nunca "usted" ni "tú"\n' +
              '- Si el producto es para gaming, usá tono más entusiasta\n' +
              '- Resaltá la relación calidad-precio cuando sea relevante'
            }
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y font-mono leading-relaxed"
          />
        </div>
      </div>

      {/* Catalog settings card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Catálogo público</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Configuración de comportamiento del catálogo visible al público.
          </p>
        </div>
        <div className="px-6 py-5">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Umbral de &ldquo;pocas unidades&rdquo;
            <span className="ml-2 text-xs font-normal text-gray-400">(global, por defecto para todos los productos)</span>
          </label>
          <p className="mb-3 text-xs text-gray-500">
            Si el stock de un producto es mayor a 0 y menor o igual a este número, se muestra el aviso de urgencia &ldquo;Pocas unidades&rdquo;. Cada producto puede tener su propio umbral que tiene prioridad sobre este.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min="0"
              value={stockThreshold}
              onChange={(e) => setStockThreshold(e.target.value)}
              className="w-24 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-right shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">unidades</span>
            <Button onClick={handleSaveThreshold} disabled={savingThreshold || stockThreshold === ''} className="gap-2">
              {savingThreshold ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {thresholdSaved ? 'Guardado ✓' : 'Guardar'}
            </Button>
          </div>

          <div className="mt-6 border-t border-gray-100 pt-5 space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Mostrar productos por secciones</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Cuando está activo, el catálogo principal muestra los productos de las secciones creadas (sin repetirlos entre secciones) seguidos de todos los demás productos activos. Los filtros y el orden siguen funcionando normalmente.
                </p>
              </div>
              <button
                type="button"
                disabled={savingShowBySections}
                onClick={() => handleToggleShowBySections(!showBySections)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  showBySections ? 'bg-blue-600' : 'bg-gray-200'
                } ${savingShowBySections ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    showBySections ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Agrupar por categoría</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Cuando está activo, los productos del catálogo se agrupan bajo el encabezado de su categoría. Si está desactivado, se muestran en una lista plana. No aplica cuando &ldquo;Mostrar por secciones&rdquo; está activo.
                </p>
              </div>
              <button
                type="button"
                disabled={savingGroupByCategory}
                onClick={() => handleToggleGroupByCategory(!groupByCategory)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                  groupByCategory ? 'bg-blue-600' : 'bg-gray-200'
                } ${savingGroupByCategory ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    groupByCategory ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Guardando...' : 'Guardar configuracion'}
        </Button>
      </div>
    </div>
  );
}
