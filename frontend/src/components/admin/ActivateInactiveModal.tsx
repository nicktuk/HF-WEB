'use client';

import { useState } from 'react';
import { X, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActivateSelected } from '@/hooks/useProducts';
import { useApiKey } from '@/hooks/useAuth';

interface ActivateInactiveModalProps {
  selectedIds: number[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function ActivateInactiveModal({ selectedIds, onClose, onSuccess }: ActivateInactiveModalProps) {
  const apiKey = useApiKey() || '';
  const activateMutation = useActivateSelected(apiKey);

  const [markup, setMarkup] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!markup || !confirmed || selectedIds.length === 0) return;

    try {
      await activateMutation.mutateAsync({
        productIds: selectedIds,
        markupPercentage: parseFloat(markup),
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error activating products:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Power className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold">Activar Productos Seleccionados</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex gap-3">
            <Power className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-800">
              <p className="font-medium">{selectedIds.length} producto(s) seleccionado(s)</p>
              <p>Se activaran y se les aplicara el markup especificado.</p>
            </div>
          </div>

          <Input
            label="Porcentaje de markup"
            type="number"
            value={markup}
            onChange={(e) => setMarkup(e.target.value)}
            placeholder="Ej: 30"
            min="0"
            step="0.1"
            required
            helperText="Se aplicara este markup a los productos seleccionados"
          />

          <label className="flex items-center gap-3 p-3 bg-gray-50 border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">
              Confirmo que quiero activar <strong>{selectedIds.length}</strong> producto(s) con <strong>{markup || '0'}%</strong> de markup
            </span>
          </label>

          {activateMutation.isError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              Error al activar los productos. Intenta nuevamente.
            </div>
          )}

          {activateMutation.isSuccess && (
            <div className="p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              Productos activados correctamente.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={activateMutation.isPending}
              disabled={!markup || !confirmed || selectedIds.length === 0}
            >
              Activar {selectedIds.length} Producto(s)
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
