'use client';

import { useState, useEffect } from 'react';
import { X, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useActivateSelected, useCategories, useAdminSubcategories, useAdminCategories } from '@/hooks/useProducts';
import { useApiKey } from '@/hooks/useAuth';
import type { Category, Subcategory } from '@/types';

interface ActivateInactiveModalProps {
  selectedIds: number[];
  existingMarkup?: number; // Pass the highest existing markup from selected products
  onClose: () => void;
  onSuccess?: () => void;
}

export function ActivateInactiveModal({ selectedIds, existingMarkup, onClose, onSuccess }: ActivateInactiveModalProps) {
  const apiKey = useApiKey() || '';
  const activateMutation = useActivateSelected(apiKey);
  const { data: existingCategories } = useCategories();
  const { data: adminCategories } = useAdminCategories();
  const categories = adminCategories as Category[] | undefined;

  // Initialize markup with existing value if > 0
  const [markup, setMarkup] = useState(existingMarkup !== undefined ? existingMarkup.toString() : '');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [customSubcategory, setCustomSubcategory] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const finalCategory = category === '__custom__' ? customCategory : category;
  const finalSubcategory = subcategory === '__custom__' ? customSubcategory : subcategory;

  // Get subcategories for selected category
  const selectedCategoryObj = categories?.find(c => c.name === finalCategory);
  const { data: availableSubcategories } = useAdminSubcategories(selectedCategoryObj?.id);
  const subcategories = availableSubcategories as Subcategory[] | undefined;

  // Reset subcategory when category changes
  useEffect(() => {
    setSubcategory('');
    setCustomSubcategory('');
  }, [category, customCategory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (markup === '' || !confirmed || selectedIds.length === 0) return;

    try {
      await activateMutation.mutateAsync({
        productIds: selectedIds,
        markupPercentage: parseFloat(markup),
        category: finalCategory || undefined,
        subcategory: finalSubcategory || undefined,
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
              <p>Se activaran y se les aplicara el markup y categoria especificados.</p>
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

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Sin cambio de categoria</option>
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
              />
            )}
            <p className="text-xs text-gray-500">
              Opcional: asignar una categoria a los productos activados
            </p>
          </div>

          {/* Subcategory - only show when category is selected */}
          {finalCategory && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Subcategoria
              </label>
              <select
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="">Sin subcategoria</option>
                {subcategories?.map((sub) => (
                  <option key={sub.name} value={sub.name}>
                    {sub.name}
                  </option>
                ))}
                <option value="__custom__">+ Nueva subcategoria...</option>
              </select>
              {subcategory === '__custom__' && (
                <Input
                  type="text"
                  value={customSubcategory}
                  onChange={(e) => setCustomSubcategory(e.target.value)}
                  placeholder="Nombre de la nueva subcategoria"
                  maxLength={100}
                />
              )}
              <p className="text-xs text-gray-500">
                Opcional: asignar una subcategoria a los productos activados
              </p>
            </div>
          )}

          <label className="flex items-center gap-3 p-3 bg-gray-50 border rounded-lg cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm">
              Confirmo que quiero activar <strong>{selectedIds.length}</strong> producto(s)
              con <strong>{markup || '0'}%</strong> de markup
              {finalCategory && <> en categoria <strong>{finalCategory}</strong></>}
              {finalSubcategory && <>, subcategoria <strong>{finalSubcategory}</strong></>}
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
              disabled={markup === '' || !confirmed || selectedIds.length === 0}
            >
              Activar {selectedIds.length} Producto(s)
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
