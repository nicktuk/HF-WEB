'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Package, Eye, EyeOff, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiKey } from '@/hooks/useAuth';
import { adminApi, uploadImages, resolveImageUrl } from '@/lib/api';
import type { Section, ProductInSection, ProductAdmin } from '@/types';

const CRITERIA_OPTIONS = [
  { value: 'manual', label: 'Manual (productos asignados)' },
  { value: 'featured', label: 'Nuevos ingresos / Destacados' },
  { value: 'immediate_delivery', label: 'Entrega inmediata' },
  { value: 'best_seller', label: 'Más vendidos' },
  { value: 'category', label: 'Por categoría' },
];

const CRITERIA_LABELS: Record<string, string> = {
  manual: 'Manual',
  featured: 'Destacados',
  immediate_delivery: 'Entrega inmediata',
  best_seller: 'Más vendidos',
  category: 'Por categoría',
};

interface SectionForm {
  title: string;
  subtitle: string;
  display_order: number;
  is_active: boolean;
  criteria_type: string;
  criteria_value: string;
  max_products: number;
  bg_color: string;
  text_color: string;
  image_url: string;
  position: 'arriba' | 'abajo';
}

const DEFAULT_FORM: SectionForm = {
  title: '',
  subtitle: '',
  display_order: 0,
  is_active: true,
  criteria_type: 'manual',
  criteria_value: '',
  max_products: 8,
  bg_color: '#0D1B2A',
  text_color: '#ffffff',
  image_url: '',
  position: 'abajo',
};

export default function SeccionesPage() {
  const apiKey = useApiKey() || '';
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState<SectionForm>(DEFAULT_FORM);
  const [formError, setFormError] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  // Product search state (for manual sections)
  const [productSearch, setProductSearch] = useState('');
  const [managingSection, setManagingSection] = useState<Section | null>(null);
  const [showProductsModal, setShowProductsModal] = useState(false);

  const { data: sections, isLoading } = useQuery({
    queryKey: ['admin-sections', apiKey],
    queryFn: () => adminApi.getSections(apiKey),
    enabled: !!apiKey,
  });

  // Product search query
  const { data: searchResults, isFetching: isSearching } = useQuery({
    queryKey: ['admin-product-search', apiKey, productSearch],
    queryFn: () => adminApi.getProducts(apiKey, { search: productSearch, enabled: true, limit: 20 }),
    enabled: !!apiKey && productSearch.trim().length >= 2,
    staleTime: 30 * 1000,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Section>) => adminApi.createSection(apiKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sections'] });
      closeModal();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Section> }) =>
      adminApi.updateSection(apiKey, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sections'] });
      closeModal();
    },
    onError: (err: Error) => setFormError(err.message),
  });

  const [deleteError, setDeleteError] = useState('');

  const deleteMutation = useMutation({
    mutationFn: (id: number) => adminApi.deleteSection(apiKey, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sections'] });
      setDeleteError('');
    },
    onError: (err: Error) => setDeleteError(err.message),
  });

  const addProductMutation = useMutation({
    mutationFn: ({ sectionId, productId }: { sectionId: number; productId: number }) =>
      adminApi.addProductToSection(apiKey, sectionId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sections'] });
      // Refresh managing section data
      if (managingSection) {
        queryClient.invalidateQueries({ queryKey: ['admin-sections'] });
      }
    },
  });

  const removeProductMutation = useMutation({
    mutationFn: ({ sectionId, productId }: { sectionId: number; productId: number }) =>
      adminApi.removeProductFromSection(apiKey, sectionId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sections'] });
    },
  });

  function openCreate() {
    setEditingSection(null);
    setFormData(DEFAULT_FORM);
    setFormError('');
    setFileInputKey(k => k + 1);
    setShowModal(true);
  }

  function openEdit(section: Section) {
    setEditingSection(section);
    setFormData({
      title: section.title,
      subtitle: section.subtitle || '',
      display_order: section.display_order,
      is_active: section.is_active,
      criteria_type: section.criteria_type,
      criteria_value: section.criteria_value || '',
      max_products: section.max_products,
      bg_color: section.bg_color || '#0D1B2A',
      text_color: section.text_color || '#ffffff',
      image_url: section.image_url || '',
      position: section.position || 'abajo',
    });
    setFormError('');
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingSection(null);
    setFormData(DEFAULT_FORM);
    setFormError('');
    setFileInputKey(k => k + 1);
  }

  function openProductsModal(section: Section) {
    setManagingSection(section);
    setProductSearch('');
    setShowProductsModal(true);
  }

  function closeProductsModal() {
    setShowProductsModal(false);
    setManagingSection(null);
    setProductSearch('');
  }

  function handleSave() {
    setFormError('');
    if (!formData.title.trim()) {
      setFormError('El título es requerido');
      return;
    }
    const payload: Partial<Section> = {
      title: formData.title.trim(),
      subtitle: formData.subtitle.trim() || null,
      display_order: formData.display_order,
      is_active: formData.is_active,
      criteria_type: formData.criteria_type,
      criteria_value: formData.criteria_value.trim() || null,
      max_products: formData.max_products,
      bg_color: formData.bg_color,
      text_color: formData.text_color,
      image_url: formData.image_url.trim() || null,
      position: formData.position,
    };

    if (editingSection) {
      updateMutation.mutate({ id: editingSection.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Get the latest data for the managing section from the query cache
  const latestManagingSection = managingSection
    ? sections?.find((s) => s.id === managingSection.id) || managingSection
    : null;

  const assignedProductIds = new Set(latestManagingSection?.products.map((p) => p.id) || []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Secciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Bloques de productos que se muestran en el catálogo y las páginas de productos.
          </p>
        </div>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nueva sección
        </Button>
      </div>

      {/* Delete error */}
      {deleteError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>Error al eliminar: {deleteError}</span>
          <button onClick={() => setDeleteError('')} className="ml-4 text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : !sections || sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No hay secciones creadas</p>
            <p className="text-sm mt-1">Crea una sección para empezar a mostrar productos destacados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sections.map((section) => (
            <Card key={section.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Color preview */}
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0 border border-black/10"
                    style={{ backgroundColor: section.bg_color || '#0D1B2A' }}
                  />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">{section.title}</span>
                      <Badge
                        variant={section.is_active ? 'success' : 'warning'}
                        className="text-xs"
                      >
                        {section.is_active ? 'Activa' : 'Inactiva'}
                      </Badge>
                      <Badge variant="info" className="text-xs">
                        {CRITERIA_LABELS[section.criteria_type] || section.criteria_type}
                      </Badge>
                      {section.criteria_type === 'category' && section.criteria_value && (
                        <Badge variant="info" className="text-xs">
                          {section.criteria_value}
                        </Badge>
                      )}
                    </div>
                    {section.subtitle && (
                      <p className="text-sm text-gray-500 truncate mt-0.5">{section.subtitle}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Orden: {section.display_order} · Máx. productos: {section.max_products}
                      {section.criteria_type === 'manual' && ` · ${section.products.length} asignados`}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {section.criteria_type === 'manual' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openProductsModal(section)}
                        className="flex items-center gap-1"
                      >
                        <Package className="h-3.5 w-3.5" />
                        Productos
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(section)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:border-red-300"
                      onClick={() => {
                        if (confirm(`¿Eliminar la sección "${section.title}"?`)) {
                          deleteMutation.mutate(section.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal isOpen={showModal} onClose={closeModal}>
        <ModalContent>
          <div className="p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-6">
              {editingSection ? 'Editar sección' : 'Nueva sección'}
            </h2>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Título <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Ej: Entrega inmediata"
                  maxLength={100}
                />
              </div>

              {/* Subtitle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subtítulo <span className="text-gray-400">(opcional)</span>
                </label>
                <Input
                  value={formData.subtitle}
                  onChange={(e) => setFormData((f) => ({ ...f, subtitle: e.target.value }))}
                  placeholder="Ej: Productos disponibles hoy"
                  maxLength={200}
                />
              </div>

              {/* Two columns: display_order + max_products */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Orden de display
                  </label>
                  <Input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, display_order: parseInt(e.target.value) || 0 }))
                    }
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Máx. productos
                  </label>
                  <Input
                    type="number"
                    value={formData.max_products}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        max_products: Math.max(1, Math.min(50, parseInt(e.target.value) || 8)),
                      }))
                    }
                    min={1}
                    max={50}
                  />
                </div>
              </div>

              {/* Criteria type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Criterio de productos
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.criteria_type}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, criteria_type: e.target.value, criteria_value: '' }))
                  }
                >
                  {CRITERIA_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Criteria value (only for category) */}
              {formData.criteria_type === 'category' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de categoría
                  </label>
                  <Input
                    value={formData.criteria_value}
                    onChange={(e) => setFormData((f) => ({ ...f, criteria_value: e.target.value }))}
                    placeholder="Ej: Herramientas"
                    maxLength={100}
                  />
                </div>
              )}

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color de fondo
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.bg_color}
                      onChange={(e) => setFormData((f) => ({ ...f, bg_color: e.target.value }))}
                      className="h-9 w-14 rounded border border-gray-300 cursor-pointer p-0.5"
                    />
                    <Input
                      value={formData.bg_color}
                      onChange={(e) => setFormData((f) => ({ ...f, bg_color: e.target.value }))}
                      placeholder="#0D1B2A"
                      maxLength={7}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Color de texto
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.text_color}
                      onChange={(e) => setFormData((f) => ({ ...f, text_color: e.target.value }))}
                      className="h-9 w-14 rounded border border-gray-300 cursor-pointer p-0.5"
                    />
                    <Input
                      value={formData.text_color}
                      onChange={(e) => setFormData((f) => ({ ...f, text_color: e.target.value }))}
                      placeholder="#ffffff"
                      maxLength={7}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Imagen de la tarjeta
                </label>
                <div className="space-y-2">
                  {formData.image_url && (
                    <div className="relative w-full h-32 rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={resolveImageUrl(formData.image_url) ?? formData.image_url}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData((f) => ({ ...f, image_url: '' }))}
                        className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/80"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                  <label
                    className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-gray-300 cursor-pointer text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors ${isUploadingImage ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {isUploadingImage ? 'Subiendo...' : '+ Subir imagen'}
                    <input
                      key={fileInputKey}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploadingImage(true);
                        try {
                          const urls = await uploadImages(apiKey, [file]);
                          setFormData((f) => ({ ...f, image_url: urls[0] }));
                        } catch (err) {
                          console.error('Error subiendo imagen', err);
                        } finally {
                          setIsUploadingImage(false);
                        }
                      }}
                    />
                  </label>
                  <Input
                    value={formData.image_url}
                    onChange={(e) => setFormData((f) => ({ ...f, image_url: e.target.value }))}
                    placeholder="https://... (o subir imagen arriba)"
                    className="text-sm"
                  />
                </div>
              </div>

              {/* Preview */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vista previa del encabezado
                </label>
                <div
                  className="rounded-xl px-5 py-4"
                  style={{ backgroundColor: formData.bg_color }}
                >
                  <p
                    className="text-base font-extrabold tracking-tight"
                    style={{ color: formData.text_color }}
                  >
                    {formData.title || 'Título de la sección'}
                  </p>
                  {formData.subtitle && (
                    <p
                      className="text-sm opacity-75 mt-0.5"
                      style={{ color: formData.text_color }}
                    >
                      {formData.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Position */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Posición
                </label>
                <div className="flex gap-3">
                  {(['arriba', 'abajo'] as const).map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setFormData(f => ({ ...f, position: pos }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        formData.position === pos
                          ? 'bg-[#0D1B2A] text-white border-[#0D1B2A]'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {pos === 'arriba' ? '↑ Arriba (antes de productos)' : '↓ Abajo (después de productos)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium text-gray-700">Activa</p>
                  <p className="text-xs text-gray-500">La sección se mostrará en el catálogo público.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    formData.is_active ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
                      formData.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" onClick={closeModal} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : editingSection ? 'Guardar cambios' : 'Crear sección'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Products Management Modal */}
      <Modal isOpen={showProductsModal} onClose={closeProductsModal} size="xl">
        <ModalContent>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">
                Productos de &ldquo;{latestManagingSection?.title}&rdquo;
              </h2>
              <button
                onClick={closeProductsModal}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Assigned products */}
            {latestManagingSection && latestManagingSection.products.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-medium text-gray-700 mb-2">
                  Asignados ({latestManagingSection.products.length})
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {latestManagingSection.products.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-2 rounded-lg border border-gray-100 bg-gray-50"
                    >
                      {p.images[0] && (
                        <img
                          src={p.images[0].url}
                          alt={p.name}
                          className="w-10 h-10 rounded object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                        {p.category && (
                          <p className="text-xs text-gray-500">{p.category}</p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          if (latestManagingSection) {
                            removeProductMutation.mutate({
                              sectionId: latestManagingSection.id,
                              productId: p.id,
                            });
                          }
                        }}
                        className="flex-shrink-0 p-1 rounded text-red-500 hover:bg-red-50"
                        disabled={removeProductMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Product search */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Agregar producto</p>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Buscar productos..."
                  className="pl-9"
                />
              </div>

              {isSearching && (
                <p className="text-sm text-gray-500 text-center py-3">Buscando...</p>
              )}

              {!isSearching && productSearch.trim().length >= 2 && searchResults && (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {searchResults.items.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-3">Sin resultados</p>
                  ) : (
                    searchResults.items.map((p) => {
                      const isAssigned = assignedProductIds.has(p.id);
                      const hasStock = Number(p.stock_qty || 0) > 0;
                      const isDisabled = isAssigned || !hasStock || addProductMutation.isPending;
                      return (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 p-2 rounded-lg border ${
                            !hasStock ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-100 hover:bg-gray-50'
                          }`}
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            {p.images[0] ? (
                              <img
                                src={resolveImageUrl(p.images[0].url) ?? p.images[0].url}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <Package className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 line-clamp-2 leading-snug">{p.name}</p>
                            <p className={`text-xs mt-0.5 ${hasStock ? 'text-emerald-600' : 'text-gray-400'}`}>
                              {hasStock ? `Stock: ${p.stock_qty}` : 'Sin stock'}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={isAssigned ? 'secondary' : 'primary'}
                            disabled={isDisabled}
                            title={!hasStock ? 'Sin stock — no se puede agregar a la sección' : undefined}
                            onClick={() => {
                              if (latestManagingSection && !isDisabled) {
                                addProductMutation.mutate({
                                  sectionId: latestManagingSection.id,
                                  productId: p.id,
                                });
                              }
                            }}
                            className="flex-shrink-0 text-xs"
                          >
                            {isAssigned ? 'Asignado' : 'Agregar'}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {productSearch.trim().length > 0 && productSearch.trim().length < 2 && (
                <p className="text-xs text-gray-400 text-center py-2">
                  Escribe al menos 2 caracteres para buscar
                </p>
              )}
            </div>
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="outline" onClick={closeProductsModal}>
            Cerrar
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
