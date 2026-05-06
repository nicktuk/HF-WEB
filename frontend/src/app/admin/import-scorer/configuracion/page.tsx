'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISConfig } from '@/types';

export default function ConfiguracionPage() {
  const apiKey = useApiKey() || '';
  const qc = useQueryClient();
  const [toast, setToast] = useState('');
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const { data: config, isLoading } = useQuery({
    queryKey: ['is-config'],
    queryFn: () => importScorerApi.getConfig(apiKey),
    enabled: !!apiKey,
  });

  const [form, setForm] = useState<Partial<ISConfig>>({});

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ISConfig>) => importScorerApi.updateConfig(apiKey, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-config'] }); showToast('Configuración guardada'); },
  });

  const current = { ...config, ...form };

  const fields: { key: keyof ISConfig; label: string; step?: string }[] = [
    { key: 'costo_flete_usd_por_kg', label: 'Costo flete USD/kg', step: '0.5' },
    { key: 'sales_tax_fl', label: 'Sales tax FL (ej: 0.07)', step: '0.001' },
    { key: 'margen_minimo_verde_global', label: 'Margen mínimo verde (×)', step: '0.1' },
    { key: 'margen_minimo_amarillo_global', label: 'Margen mínimo amarillo (×)', step: '0.1' },
    { key: 'fee_agencia_compra_fisica', label: 'Fee agencia compra física USD', step: '5' },
    { key: 'umbral_lista_caza_usd', label: 'Umbral lista caza USD', step: '50' },
    { key: 'peso_minimo_envio', label: 'Peso mínimo envío (kg)', step: '1' },
    { key: 'peso_optimo_envio', label: 'Peso óptimo envío (kg)', step: '1' },
    { key: 'peso_maximo_envio', label: 'Peso máximo envío (kg)', step: '1' },
    { key: 'capital_maximo_envio', label: 'Capital máximo envío USD', step: '100' },
  ];

  return (
    <div className="space-y-4 max-w-xl">
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div>
        <h1 className="text-xl font-bold text-gray-900">Configuración Global</h1>
        <p className="text-sm text-gray-500 mt-0.5">Parámetros de cálculo usados por defecto en todo el sistema.</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          {fields.map(({ key, label, step }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="number"
                step={step ?? '1'}
                value={form[key] !== undefined ? form[key] as number : (config?.[key] ?? '')}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}

          <button
            onClick={() => updateMutation.mutate(form)}
            disabled={updateMutation.isPending || Object.keys(form).length === 0}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {updateMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      )}
    </div>
  );
}
