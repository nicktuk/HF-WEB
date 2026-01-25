'use client';

import { useState } from 'react';
import { X, Percent, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useBulkSetMarkup } from '@/hooks/useProducts';
import { useApiKey } from '@/hooks/useAuth';

interface BulkMarkupModalProps {
  onClose: () => void;
}

export function BulkMarkupModal({ onClose }: BulkMarkupModalProps) {
  const apiKey = useApiKey() || '';
  const bulkMarkupMutation = useBulkSetMarkup(apiKey);

  const [markup, setMarkup] = useState('');
  const [onlyEnabled, setOnlyEnabled] = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!markup || !confirmed) return;

    try {
      await bulkMarkupMutation.mutateAsync({
        markupPercentage: parseFloat(markup),
        onlyEnabled,
      });
      onClose();
    } catch (error) {
      console.error('Error applying bulk markup:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Percent className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold">Aplicar Markup Masivo</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-medium">Atencion</p>
              <p>Esta accion aplicara el mismo porcentaje de markup a todos los productos seleccionados, sobrescribiendo los valores actuales.</p>
            </div>
          </div>

          <Input
            label="Porcentaje de markup"
            type="number"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            placeholder="Ej: 50"
            min="0"
            step="0.1"
            required
            helperText="El precio final sera: precio origen + X%"
          />

          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="scope"
                checked={onlyEnabled}
                onChange={() => setOnlyEnabled(true)}
                className="h-4 w-4 text-primary-600"
              />
              <div>
                <p className="font-medium">Solo productos habilitados</p>
                <p className="text-sm text-gray-500">Aplica solo a los productos visibles en el catalogo</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="scope"
                checked={!onlyEnabled}
                onChange={() => setOnlyEnabled(false)}
                className="h-4 w-4 text-primary-600"
              />
              <div>
                <p className="font-medium">Todos los productos</p>
                <p className="text-sm text-gray-500">Aplica a todos, incluyendo deshabilitados</p>
              </div>
            </label>
          </div>

          <label className="flex items-center gap-3 p-3 bg-gray-50 border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">
              Confirmo que quiero aplicar <strong>{markup || '0'}%</strong> de markup a {onlyEnabled ? 'los productos habilitados' : 'todos los productos'}
            </span>
          </label>

          {bulkMarkupMutation.isError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              Error al aplicar el markup. Intenta nuevamente.
            </div>
          )}

          {bulkMarkupMutation.isSuccess && (
            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              Markup aplicado correctamente.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={bulkMarkupMutation.isPending}
              disabled={!markup || !confirmed}
            >
              Aplicar Markup
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
