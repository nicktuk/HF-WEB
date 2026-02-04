'use client';

import { useState } from 'react';
import { X, FolderEdit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useChangeCategorySelected, useCategories } from '@/hooks/useProducts';
import { useApiKey } from '@/hooks/useAuth';

interface ChangeCategoryModalProps {
  selectedIds: number[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function ChangeCategoryModal({ selectedIds, onClose, onSuccess }: ChangeCategoryModalProps) {
  const apiKey = useApiKey() || '';
  const changeCategoryMutation = useChangeCategorySelected(apiKey);
  const { data: existingCategories } = useCategories();

  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const finalCategory = category === '__custom__' ? customCategory : category;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!finalCategory || !confirmed || selectedIds.length === 0) return;

    try {
      await changeCategoryMutation.mutateAsync({
        productIds: selectedIds,
        category: finalCategory,
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error changing category:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FolderEdit className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Cambiar Categoria</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
            <FolderEdit className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">{selectedIds.length} producto(s) seleccionado(s)</p>
              <p>Se les asignara la categoria especificada.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
              required
            >
              <option value="">Seleccionar categoria...</option>
              {existingCategories?.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
              <option value="__custom__">+ Nueva categoria...</option>
            </select>
            {category === '__custom__' && (
              <Input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Nombre de la nueva categoria"
                maxLength={100}
                required
              />
            )}
          </div>

          <label className="flex items-center gap-3 p-3 bg-gray-50 border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">
              Confirmo que quiero asignar la categoria <strong>{finalCategory || '...'}</strong> a <strong>{selectedIds.length}</strong> producto(s)
            </span>
          </label>

          {changeCategoryMutation.isError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              Error al cambiar la categoria. Intenta nuevamente.
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={changeCategoryMutation.isPending}
              disabled={!finalCategory || !confirmed || selectedIds.length === 0}
            >
              Cambiar Categoria
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
