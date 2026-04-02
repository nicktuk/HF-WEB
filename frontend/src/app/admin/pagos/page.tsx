'use client';

import { useEffect, useState } from 'react';
import { CreditCard, Plus, Trash2, GripVertical, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';

export default function PagosConfigPage() {
  const apiKey = useApiKey() || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [methods, setMethods] = useState<string[]>([]);
  const [newMethod, setNewMethod] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!apiKey) return;
    adminApi.getPaymentMethods(apiKey)
      .then(setMethods)
      .catch(() => showToast('error', 'No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, [apiKey]);

  async function save(updated: string[]) {
    setSaving(true);
    try {
      const result = await adminApi.updatePaymentMethods(apiKey, updated);
      setMethods(result);
      showToast('success', 'Guardado');
    } catch {
      showToast('error', 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    const trimmed = newMethod.trim();
    if (!trimmed || methods.includes(trimmed)) return;
    setNewMethod('');
    save([...methods, trimmed]);
  }

  function handleRemove(idx: number) {
    save(methods.filter((_, i) => i !== idx));
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return;
    const updated = [...methods];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    save(updated);
  }

  function handleMoveDown(idx: number) {
    if (idx === methods.length - 1) return;
    const updated = [...methods];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    save(updated);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-gray-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Métodos de pago</h1>
          <p className="text-sm text-gray-500">
            Se usan al registrar pagos en compras de stock.
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {toast.type === 'success'
            ? <CheckCircle className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />}
          {toast.message}
        </div>
      )}

      {/* Lista */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Métodos configurados</h2>
        </div>
        <ul className="divide-y divide-gray-100">
          {methods.length === 0 && (
            <li className="px-6 py-4 text-sm text-gray-400">Sin métodos configurados.</li>
          )}
          {methods.map((m, i) => (
            <li key={m} className="flex items-center gap-3 px-6 py-3">
              <GripVertical className="h-4 w-4 text-gray-300 shrink-0" />
              <span className="flex-1 text-sm text-gray-800">{m}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={i === 0 || saving}
                  onClick={() => handleMoveUp(i)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Subir"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === methods.length - 1 || saving}
                  onClick={() => handleMoveDown(i)}
                  className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
                  title="Bajar"
                >
                  ↓
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleRemove(i)}
                  className="p-1 rounded text-red-400 hover:text-red-600 disabled:opacity-30"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        {/* Agregar */}
        <div className="border-t border-gray-100 px-6 py-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="Nuevo método de pago..."
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="button"
              disabled={!newMethod.trim() || saving}
              onClick={handleAdd}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
        </div>
      </div>

      {saving && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Guardando...
        </div>
      )}
    </div>
  );
}
