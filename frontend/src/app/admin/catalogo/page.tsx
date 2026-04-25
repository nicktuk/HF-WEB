'use client';

import { useEffect, useState } from 'react';
import { Store, Save, Loader2, CheckCircle, AlertCircle, Upload, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApiKey } from '@/hooks/useAuth';
import { adminApi, uploadImages, resolveImageUrl } from '@/lib/api';
import { useRef } from 'react';

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

  // Carousel style
  const [carouselStyle, setCarouselStyle] = useState<'scroll' | 'slider'>('scroll');
  const [savingCarouselStyle, setSavingCarouselStyle] = useState(false);

  // Group by category
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [savingGroupByCategory, setSavingGroupByCategory] = useState(false);

  // Popup
  const [popupEnabled, setPopupEnabled] = useState(false);
  const [popupInterval, setPopupInterval] = useState(2);
  const [popupSlides, setPopupSlides] = useState<Array<{ image: string; link: string }>>([]);
  const [savingPopup, setSavingPopup] = useState(false);
  const [uploadingPopup, setUploadingPopup] = useState(false);
  const [newPopupUrl, setNewPopupUrl] = useState('');
  const popupFileRef = useRef<HTMLInputElement>(null);

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
        setCarouselStyle(data.carousel_style === 'slider' ? 'slider' : 'scroll');
        setPopupEnabled(data.popup_enabled ?? false);
        setPopupInterval(data.popup_interval ?? 2);
        setPopupSlides(data.popup_slides ?? []);
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

  async function handleChangeCarouselStyle(value: 'scroll' | 'slider') {
    setCarouselStyle(value);
    setSavingCarouselStyle(true);
    try {
      await adminApi.updateCatalogSettings(apiKey, { carousel_style: value });
    } catch {
      showToast('error', 'Error al guardar la configuración');
    } finally {
      setSavingCarouselStyle(false);
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

  async function handlePopupFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingPopup(true);
    try {
      const urls = await uploadImages(apiKey, files);
      setPopupSlides(prev => [...prev, ...urls.map(image => ({ image, link: '' }))]);
    } catch {
      showToast('error', 'Error al subir imágenes');
    } finally {
      setUploadingPopup(false);
      if (popupFileRef.current) popupFileRef.current.value = '';
    }
  }

  function handleAddPopupUrl() {
    const url = newPopupUrl.trim();
    if (url) {
      setPopupSlides(prev => [...prev, { image: url, link: '' }]);
      setNewPopupUrl('');
    }
  }

  async function handleSavePopup() {
    setSavingPopup(true);
    try {
      await adminApi.updateCatalogSettings(apiKey, {
        popup_enabled: popupEnabled,
        popup_interval: popupInterval,
        popup_slides: popupSlides,
      });
      showToast('success', 'Popup guardado');
    } catch {
      showToast('error', 'Error al guardar');
    } finally {
      setSavingPopup(false);
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

      {/* Estilo de carrusel */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Estilo del carrusel</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Cómo se muestran las categorías destacadas en el catálogo público.
          </p>
        </div>
        <div className="px-6 py-5">
          <div className="flex gap-3">
            <button
              type="button"
              disabled={savingCarouselStyle}
              onClick={() => handleChangeCarouselStyle('scroll')}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left ${
                carouselStyle === 'scroll'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <p className="font-semibold">Scroll infinito</p>
              <p className="text-xs opacity-70 mt-0.5">Tarjetas verticales que se desplazan automáticamente</p>
            </button>
            <button
              type="button"
              disabled={savingCarouselStyle}
              onClick={() => handleChangeCarouselStyle('slider')}
              className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left ${
                carouselStyle === 'slider'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <p className="font-semibold">Slider</p>
              <p className="text-xs opacity-70 mt-0.5">Imagen a la izquierda que vuela, categoría a la derecha</p>
            </button>
            {savingCarouselStyle && <Loader2 className="h-4 w-4 animate-spin text-gray-400 self-center shrink-0" />}
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
      {/* Popup de sesión */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h2 className="font-medium text-gray-800">Popup de sesión</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Carrusel que aparece una sola vez por sesión al ingresar al catálogo. Ideal para novedades o promociones.
          </p>
        </div>
        <div className="px-6 py-5 space-y-5">

          {/* Toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Activar popup</p>
            <button
              type="button"
              onClick={() => setPopupEnabled(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                popupEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${popupEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Interval */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 shrink-0">Segundos por imagen</label>
            <input
              type="number"
              min={1}
              max={30}
              value={popupInterval}
              onChange={e => setPopupInterval(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-center shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-xs text-gray-400">seg</span>
          </div>

          {/* Slides list */}
          {popupSlides.length > 0 && (
            <div className="space-y-3">
              {popupSlides.map((slide, i) => {
                const src = resolveImageUrl(slide.image) ?? slide.image;
                return (
                  <div key={i} className="flex gap-3 items-start rounded-lg border border-gray-200 p-2 bg-gray-50">
                    {/* Thumbnail */}
                    <div className="relative shrink-0 w-16 h-16 rounded-md overflow-hidden border border-gray-200 bg-white">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <div className="absolute bottom-0.5 left-0.5 rounded bg-black/40 px-1 text-[10px] text-white font-medium leading-none py-0.5">{i + 1}</div>
                    </div>
                    {/* Link input */}
                    <div className="flex-1 min-w-0">
                      <label className="text-xs text-gray-500 mb-1 block">URL de destino (opcional)</label>
                      <input
                        type="text"
                        value={slide.link}
                        onChange={e => setPopupSlides(prev => prev.map((s, j) => j === i ? { ...s, link: e.target.value } : s))}
                        placeholder="https://..."
                        className="w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    {/* Remove */}
                    <button
                      type="button"
                      onClick={() => setPopupSlides(prev => prev.filter((_, j) => j !== i))}
                      className="shrink-0 mt-5 flex items-center justify-center w-7 h-7 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      aria-label="Eliminar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload + URL */}
          <div className="space-y-3">
            <input
              ref={popupFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePopupFileUpload}
            />
            <button
              type="button"
              onClick={() => popupFileRef.current?.click()}
              disabled={uploadingPopup}
              className="flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors w-full justify-center disabled:opacity-50"
            >
              {uploadingPopup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploadingPopup ? 'Subiendo...' : 'Subir imágenes'}
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={newPopupUrl}
                onChange={e => setNewPopupUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddPopupUrl()}
                placeholder="O pegá una URL..."
                className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleAddPopupUrl}
                disabled={!newPopupUrl.trim()}
                className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Agregar
              </button>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button onClick={handleSavePopup} disabled={savingPopup} className="gap-2">
              {savingPopup ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {savingPopup ? 'Guardando...' : 'Guardar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
