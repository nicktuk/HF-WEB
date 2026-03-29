'use client';

import { useEffect, useState } from 'react';
import { Store, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiKey } from '@/hooks/useAuth';
import { adminApi } from '@/lib/api';

export default function CatalogoConfigPage() {
  const apiKey = useApiKey() || '';

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Stock threshold
  const [stockThreshold, setStockThreshold] = useState('5');
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [thresholdSaved, setThresholdSaved] = useState(false);

  // Show by sections
  const [showBySections, setShowBySections] = useState(false);
  const [savingShowBySections, setSavingShowBySections] = useState(false);

  // Section sort order
  const [sectionSortOrder, setSectionSortOrder] = useState<'asc' | 'desc'>('asc');
  const [savingSectionSortOrder, setSavingSectionSortOrder] = useState(false);

  // Show out of stock
  const [showOutOfStock, setShowOutOfStock] = useState(true);
  const [savingShowOutOfStock, setSavingShowOutOfStock] = useState(false);

  // Mobile two columns
  const [mobileTwoColumns, setMobileTwoColumns] = useState(false);
  const [savingMobileTwoColumns, setSavingMobileTwoColumns] = useState(false);

  // Group by category
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [savingGroupByCategory, setSavingGroupByCategory] = useState(false);

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    adminApi.getCatalogSettings(apiKey)
      .then((data) => {
        setStockThreshold(String(data.stock_low_threshold ?? 5));
        setShowBySections(data.show_by_sections ?? false);
        setGroupByCategory(data.group_by_category ?? true);
        setSectionSortOrder((data.section_sort_order === 'desc' ? 'desc' : 'asc'));
        setShowOutOfStock(data.show_out_of_stock ?? true);
        setMobileTwoColumns(data.mobile_two_columns ?? false);
      })
      .catch(() => showToast('error', 'No se pudo cargar la configuración'))
      .finally(() => setLoading(false));
  }, [apiKey]);

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

  async function handleChangeSectionSortOrder(value: 'asc' | 'desc') {
    setSectionSortOrder(value);
    setSavingSectionSortOrder(true);
    try {
      await adminApi.updateCatalogSettings(apiKey, { section_sort_order: value });
    } catch {
      showToast('error', 'Error al guardar el orden');
    } finally {
      setSavingSectionSortOrder(false);
    }
  }

  async function handleToggleShowOutOfStock(value: boolean) {
    setSavingShowOutOfStock(true);
    try {
      const updated = await adminApi.updateCatalogSettings(apiKey, { show_out_of_stock: value });
      setShowOutOfStock(updated.show_out_of_stock);
    } catch {
      showToast('error', 'Error al guardar la configuración');
    } finally {
      setSavingShowOutOfStock(false);
    }
  }

  async function handleToggleMobileTwoColumns(value: boolean) {
    setSavingMobileTwoColumns(true);
    try {
      const updated = await adminApi.updateCatalogSettings(apiKey, { mobile_two_columns: value });
      setMobileTwoColumns(updated.mobile_two_columns);
    } catch {
      showToast('error', 'Error al guardar la configuración');
    } finally {
      setSavingMobileTwoColumns(false);
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
        <Store className="h-6 w-6 text-gray-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Configuración del catálogo</h1>
          <p className="text-sm text-gray-500">
            Comportamiento del catálogo público.
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

      {/* Stock threshold */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Umbral de pocas unidades</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Si el stock de un producto es mayor a 0 y menor o igual a este número, se muestra el aviso &ldquo;Pocas unidades&rdquo;. Cada producto puede tener su propio umbral que tiene prioridad sobre este.
          </p>
        </div>
        <div className="px-6 py-5">
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
        </div>
      </div>

      {/* Vista por secciones */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Vista por secciones</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Cuando está activo, el catálogo muestra los productos según el orden de las secciones creadas, seguidos de todos los demás productos activos.
          </p>
        </div>
        <div className="space-y-5 px-6 py-5">
          {/* Toggle */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Mostrar por secciones</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Activa o desactiva la vista ordenada por secciones en el catálogo público.
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

          {/* Sort order */}
          {showBySections && (
            <div className="border-t border-gray-100 pt-5">
              <p className="mb-2 text-sm font-medium text-gray-700">Orden de las secciones</p>
              <p className="mb-3 text-xs text-gray-500">
                Define si los productos de la primera sección aparecen primero o los de la última.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={savingSectionSortOrder}
                  onClick={() => handleChangeSectionSortOrder('asc')}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    sectionSortOrder === 'asc'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Primero → último
                </button>
                <button
                  type="button"
                  disabled={savingSectionSortOrder}
                  onClick={() => handleChangeSectionSortOrder('desc')}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    sectionSortOrder === 'desc'
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Último → primero
                </button>
                {savingSectionSortOrder && <Loader2 className="h-4 w-4 animate-spin text-gray-400 self-center" />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Productos sin stock */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Productos sin stock</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Mostrar productos sin stock</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Cuando está desactivado, los productos con stock 0 no aparecen en el catálogo público, aunque estén habilitados.
              </p>
            </div>
            <button
              type="button"
              disabled={savingShowOutOfStock}
              onClick={() => handleToggleShowOutOfStock(!showOutOfStock)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                showOutOfStock ? 'bg-blue-600' : 'bg-gray-200'
              } ${savingShowOutOfStock ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  showOutOfStock ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dos columnas */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Vista mobile</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Mostrar 2 productos por fila en mobile</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Cuando está activo, el catálogo muestra 2 productos por fila en pantallas pequeñas en lugar de 1.
              </p>
            </div>
            <button
              type="button"
              disabled={savingMobileTwoColumns}
              onClick={() => handleToggleMobileTwoColumns(!mobileTwoColumns)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                mobileTwoColumns ? 'bg-blue-600' : 'bg-gray-200'
              } ${savingMobileTwoColumns ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  mobileTwoColumns ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Agrupamiento */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Agrupamiento por categoría</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            No aplica cuando &ldquo;Mostrar por secciones&rdquo; está activo.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Agrupar por categoría</p>
              <p className="mt-0.5 text-xs text-gray-500">
                Los productos del catálogo se agrupan bajo el encabezado de su categoría. Si está desactivado, se muestran en una lista plana.
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
  );
}
