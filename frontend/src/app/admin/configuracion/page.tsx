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

  // Valores originales (enmascarados) que llegaron del servidor
  const [original, setOriginal] = useState<AISettingsResponse | null>(null);

  // Estado del formulario
  const [provider, setProvider] = useState('claude');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [braveKey, setBraveKey] = useState('');
  const [batchConcurrency, setBatchConcurrency] = useState(5);
  const [promptExtra, setPromptExtra] = useState('');
  const [onDemandDescription, setOnDemandDescription] = useState('');
  const [savingCatalog, setSavingCatalog] = useState(false);
  const [popupEnabled, setPopupEnabled] = useState(false);
  const [popupImageUrl, setPopupImageUrl] = useState('');
  const [savingPopup, setSavingPopup] = useState(false);

  // ── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    Promise.all([
      settingsApi.getAI(apiKey),
      adminApi.getCatalogSettings(apiKey),
    ])
      .then(([aiData, catalogData]) => {
        setOriginal(aiData);
        setProvider(aiData.provider);
        setAnthropicKey(aiData.anthropic_key);
        setOpenaiKey(aiData.openai_key);
        setBraveKey(aiData.brave_key);
        setBatchConcurrency(aiData.batch_concurrency);
        setPromptExtra(aiData.prompt_extra);
        setOnDemandDescription(catalogData.on_demand_description);
        setPopupEnabled(catalogData.popup_enabled ?? false);
        setPopupImageUrl(catalogData.popup_image_url ?? '');
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

  async function handleSavePopup() {
    setSavingPopup(true);
    try {
      await adminApi.updateCatalogSettings(apiKey, {
        popup_enabled: popupEnabled,
        popup_image_url: popupImageUrl || null,
      });
      showToast('success', 'Configuración del popup guardada');
    } catch {
      showToast('error', 'Error al guardar');
    } finally {
      setSavingPopup(false);
    }
  }

  async function handleSaveCatalog() {
    setSavingCatalog(true);
    try {
      await adminApi.updateCatalogSettings(apiKey, { on_demand_description: onDemandDescription });
      showToast('success', 'Descripción de pedido guardada');
    } catch {
      showToast('error', 'Error al guardar');
    } finally {
      setSavingCatalog(false);
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
          <h1 className="text-xl font-semibold text-gray-900">Configuración IA</h1>
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

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Guardando...' : 'Guardar configuracion'}
        </Button>
      </div>

      {/* Popup card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Popup de sesión</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Aparece una sola vez por sesión al ingresar al catálogo. Ideal para novedades o promociones.
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Activar popup</label>
            <button
              type="button"
              onClick={() => setPopupEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                popupEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={popupEnabled}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                  popupEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">URL de la imagen</label>
            <input
              type="text"
              value={popupImageUrl}
              onChange={(e) => setPopupImageUrl(e.target.value)}
              placeholder="https://... o ruta relativa"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSavePopup} disabled={savingPopup} className="gap-2">
              {savingPopup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingPopup ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>

      {/* On-demand description card */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Catálogo por pedido</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Texto que se muestra en el detalle de los productos marcados como &quot;Por pedido&quot;.
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Descripción de pedido
            </label>
            <textarea
              value={onDemandDescription}
              onChange={(e) => setOnDemandDescription(e.target.value)}
              rows={3}
              placeholder="Este producto se consigue bajo pedido. Escribinos por WhatsApp y lo buscamos para vos."
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveCatalog} disabled={savingCatalog} className="gap-2">
              {savingCatalog ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingCatalog ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
