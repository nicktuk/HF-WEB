'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, GripVertical, Package, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiKey } from '@/hooks/useAuth';
import type {
  Category,
  CategoryCreateForm,
  CategoryMapping,
  SourceCategoryProduct,
  UnmappedSourceCategory,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// Colores predefinidos para elegir
const PRESET_COLORS = [
  { name: 'Gris', value: '#6b7280' },
  { name: 'Rojo', value: '#ef4444' },
  { name: 'Naranja', value: '#f97316' },
  { name: 'Amarillo', value: '#eab308' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Celeste', value: '#06b6d4' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Violeta', value: '#8b5cf6' },
  { name: 'Rosa', value: '#ec4899' },
];

async function fetchCategories(apiKey: string): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories?include_inactive=true`, {
    headers: { 'X-Admin-API-Key': apiKey },
  });
  if (!res.ok) throw new Error('Error al cargar categorías');
  return res.json();
}

async function fetchCategoryMappings(apiKey: string): Promise<CategoryMapping[]> {
  const res = await fetch(`${API_URL}/categories/mappings`, {
    headers: { 'X-Admin-API-Key': apiKey },
  });
  if (!res.ok) throw new Error('Error al cargar mapeos');
  return res.json();
}

async function fetchUnmappedSources(apiKey: string): Promise<UnmappedSourceCategory[]> {
  const res = await fetch(`${API_URL}/categories/unmapped-sources`, {
    headers: { 'X-Admin-API-Key': apiKey },
  });
  if (!res.ok) throw new Error('Error al cargar categorias no mapeadas');
  return res.json();
}

async function fetchSourceCategoryProducts(apiKey: string, sourceName: string): Promise<SourceCategoryProduct[]> {
  const params = new URLSearchParams({ source_name: sourceName, limit: '500' });
  const res = await fetch(`${API_URL}/categories/source-products?${params.toString()}`, {
    headers: { 'X-Admin-API-Key': apiKey },
  });
  if (!res.ok) throw new Error('Error al cargar productos de categoria origen');
  return res.json();
}

export default function CategoriasPage() {
  const apiKey = useApiKey() || '';
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [showSourceProductsModal, setShowSourceProductsModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [mapTargets, setMapTargets] = useState<Record<string, number>>({});
  const [selectedSourceName, setSelectedSourceName] = useState<string | null>(null);
  const [formData, setFormData] = useState<CategoryCreateForm>({
    name: '',
    is_active: true,
    display_order: 0,
    color: '#6b7280',
    show_in_menu: false,
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', apiKey],
    queryFn: () => fetchCategories(apiKey),
    enabled: !!apiKey,
  });

  const { data: mappings } = useQuery({
    queryKey: ['category-mappings', apiKey],
    queryFn: () => fetchCategoryMappings(apiKey),
    enabled: !!apiKey,
  });

  const { data: unmappedSources } = useQuery({
    queryKey: ['category-unmapped-sources', apiKey],
    queryFn: () => fetchUnmappedSources(apiKey),
    enabled: !!apiKey,
  });

  const { data: sourceProducts, isLoading: isLoadingSourceProducts } = useQuery({
    queryKey: ['source-category-products', apiKey, selectedSourceName],
    queryFn: () => fetchSourceCategoryProducts(apiKey, selectedSourceName || ''),
    enabled: !!apiKey && !!selectedSourceName && showSourceProductsModal,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CategoryCreateForm) => {
      const res = await fetch(`${API_URL}/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': apiKey,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Error al crear categoría');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<CategoryCreateForm> }) => {
      const res = await fetch(`${API_URL}/categories/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': apiKey,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Error al actualizar categoría');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_URL}/categories/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-API-Key': apiKey },
      });
      if (!res.ok) throw new Error('Error al eliminar categoría');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const mapMutation = useMutation({
    mutationFn: async ({ sourceName, categoryId }: { sourceName: string; categoryId: number }) => {
      const res = await fetch(`${API_URL}/categories/mappings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': apiKey,
        },
        body: JSON.stringify({
          source_name: sourceName,
          category_id: categoryId,
          apply_existing: true,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Error al mapear categoría');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['category-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['category-unmapped-sources'] });
    },
  });

  const deleteMapMutation = useMutation({
    mutationFn: async (mappingId: number) => {
      const res = await fetch(`${API_URL}/categories/mappings/${mappingId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-API-Key': apiKey },
      });
      if (!res.ok) throw new Error('Error al eliminar mapeo');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['category-unmapped-sources'] });
    },
  });

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', is_active: true, display_order: 0, color: '#6b7280', show_in_menu: false });
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      is_active: category.is_active,
      display_order: category.display_order,
      color: category.color || '#6b7280',
      show_in_menu: category.show_in_menu || false,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: '', is_active: true, display_order: 0, color: '#6b7280', show_in_menu: false });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (category: Category) => {
    if (confirm(`¿Eliminar la categoría "${category.name}"? Los productos quedarán sin categoría.`)) {
      deleteMutation.mutate(category.id);
    }
  };

  const handleToggleActive = (category: Category) => {
    updateMutation.mutate({
      id: category.id,
      data: { is_active: !category.is_active },
    });
  };

  const openSourceProductsModal = (sourceName: string) => {
    setSelectedSourceName(sourceName);
    setShowSourceProductsModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-600">
            Administra las categorías de productos
          </p>
        </div>
        <Button onClick={openCreateModal}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Categoría
        </Button>
      </div>

      {/* Categories List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : categories && categories.length > 0 ? (
        <div className="space-y-2">
          {categories.map((category) => (
            <Card key={category.id} className={!category.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-5 w-5 text-gray-400" />
                    <div
                      className="w-4 h-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: category.color || '#6b7280' }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {category.name}
                        </span>
                        {!category.is_active && (
                          <Badge variant="default">Inactiva</Badge>
                        )}
                        {category.show_in_menu && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border border-gray-300 text-gray-600">
                            <Eye className="h-3 w-3 mr-1" />
                            Menu
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Package className="h-3.5 w-3.5" />
                        {category.enabled_product_count} habilitados / {category.product_count} total
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(category)}
                    >
                      {category.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(category)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(category)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay categorías
            </h3>
            <p className="text-gray-500 mb-4">
              Crea tu primera categoría para organizar los productos
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Categoría
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Source Mapping */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Mapeador de categorías origen</h2>
            <p className="text-sm text-gray-600">
              Vincula nombres que llegan de mayoristas con tu categoría maestra.
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Categorías no mapeadas</h3>
            {!unmappedSources || unmappedSources.length === 0 ? (
              <p className="text-sm text-gray-500">No hay categorías pendientes de mapear.</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {unmappedSources.map((item) => (
                  <div key={item.source_name} className="p-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.source_name}</p>
                      <p className="text-xs text-gray-500">{item.product_count} productos</p>
                    </div>
                    <select
                      value={mapTargets[item.source_name] || categories?.[0]?.id || ''}
                      onChange={(e) =>
                        setMapTargets((prev) => ({ ...prev, [item.source_name]: Number(e.target.value) }))
                      }
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm min-w-[180px]"
                    >
                      {(categories || []).map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openSourceProductsModal(item.source_name)}
                      disabled={mapMutation.isPending}
                    >
                      Ver productos
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        mapMutation.mutate({
                          sourceName: item.source_name,
                          categoryId: mapTargets[item.source_name] || categories?.[0]?.id || 0,
                        })
                      }
                      disabled={!categories?.length || mapMutation.isPending}
                    >
                      Mapear
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">Mapeos existentes</h3>
            {!mappings || mappings.length === 0 ? (
              <p className="text-sm text-gray-500">No hay mapeos creados.</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {mappings.map((mapping) => (
                  <div key={mapping.id} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{mapping.source_name}</span> → {mapping.category_name}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMapMutation.mutate(mapping.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={showSourceProductsModal}
        onClose={() => {
          setShowSourceProductsModal(false);
          setSelectedSourceName(null);
        }}
        title={selectedSourceName ? `Productos de origen: ${selectedSourceName}` : 'Productos por categoria origen'}
        size="xl"
      >
        <ModalContent className="p-0">
          {isLoadingSourceProducts ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : !sourceProducts || sourceProducts.length === 0 ? (
            <div className="p-6 text-sm text-gray-500">No hay productos para esta categoria origen.</div>
          ) : (
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Producto</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Slug</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Source</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Estado</th>
                    <th className="px-3 py-2 text-left font-medium text-gray-600">Categoria actual</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceProducts.map((product) => (
                    <tr key={product.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2 text-gray-900">{product.name}</td>
                      <td className="px-3 py-2 text-gray-600">{product.slug}</td>
                      <td className="px-3 py-2 text-gray-600">{product.source_website_name || '-'}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs border ${product.enabled ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {product.enabled ? 'Habilitado' : 'Deshabilitado'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-gray-700">{product.mapped_category_name || 'Sin mapear'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setShowSourceProductsModal(false);
              setSelectedSourceName(null);
            }}
          >
            Cerrar
          </Button>
        </ModalFooter>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
        size="sm"
      >
        <form onSubmit={handleSubmit}>
          <ModalContent className="space-y-4">
            <Input
              label="Nombre"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Electrónica"
              required
            />

            <Input
              label="Orden de visualización"
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              helperText="Las categorías se ordenan de menor a mayor"
            />

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color.value
                        ? 'border-gray-900 scale-110'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                  title="Color personalizado"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Categoría activa
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show_in_menu"
                  checked={formData.show_in_menu}
                  onChange={(e) => setFormData({ ...formData, show_in_menu: e.target.checked })}
                  className="h-4 w-4 text-primary-600 rounded border-gray-300"
                />
                <label htmlFor="show_in_menu" className="text-sm text-gray-700">
                  Mostrar en menu mobile (junto a Nuevo y Entrega Inmediata)
                </label>
              </div>
            </div>
          </ModalContent>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingCategory ? 'Guardar' : 'Crear'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
