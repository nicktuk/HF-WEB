'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, GripVertical, Package, FolderTree } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiKey } from '@/hooks/useAuth';
import type { Subcategory, SubcategoryCreateForm, Category } from '@/types';

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

async function fetchSubcategories(apiKey: string): Promise<Subcategory[]> {
  const res = await fetch(`${API_URL}/subcategories?include_inactive=true`, {
    headers: { 'X-Admin-API-Key': apiKey },
  });
  if (!res.ok) throw new Error('Error al cargar subcategorías');
  return res.json();
}

async function fetchCategories(apiKey: string): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories?include_inactive=true`, {
    headers: { 'X-Admin-API-Key': apiKey },
  });
  if (!res.ok) throw new Error('Error al cargar categorías');
  return res.json();
}

export default function SubcategoriasPage() {
  const apiKey = useApiKey() || '';
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | null>(null);
  const [filterCategoryId, setFilterCategoryId] = useState<number | undefined>(undefined);
  const [formData, setFormData] = useState<SubcategoryCreateForm>({
    name: '',
    category_id: 0,
    is_active: true,
    display_order: 0,
    color: '#6b7280',
  });

  const { data: subcategories, isLoading } = useQuery({
    queryKey: ['subcategories', apiKey],
    queryFn: () => fetchSubcategories(apiKey),
    enabled: !!apiKey,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories', apiKey],
    queryFn: () => fetchCategories(apiKey),
    enabled: !!apiKey,
  });

  const createMutation = useMutation({
    mutationFn: async (data: SubcategoryCreateForm) => {
      const res = await fetch(`${API_URL}/subcategories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': apiKey,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Error al crear subcategoría');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subcategories'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<SubcategoryCreateForm> }) => {
      const res = await fetch(`${API_URL}/subcategories/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-API-Key': apiKey,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || 'Error al actualizar subcategoría');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subcategories'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_URL}/subcategories/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-API-Key': apiKey },
      });
      if (!res.ok) throw new Error('Error al eliminar subcategoría');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subcategories'] });
    },
  });

  const openCreateModal = () => {
    setEditingSubcategory(null);
    const defaultCategoryId = filterCategoryId || (categories && categories.length > 0 ? categories[0].id : 0);
    setFormData({ name: '', category_id: defaultCategoryId, is_active: true, display_order: 0, color: '#6b7280' });
    setShowModal(true);
  };

  const openEditModal = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setFormData({
      name: subcategory.name,
      category_id: subcategory.category_id,
      is_active: subcategory.is_active,
      display_order: subcategory.display_order,
      color: subcategory.color || '#6b7280',
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingSubcategory(null);
    setFormData({ name: '', category_id: 0, is_active: true, display_order: 0, color: '#6b7280' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSubcategory) {
      updateMutation.mutate({ id: editingSubcategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (subcategory: Subcategory) => {
    if (confirm(`¿Eliminar la subcategoría "${subcategory.name}"? Los productos quedarán sin subcategoría.`)) {
      deleteMutation.mutate(subcategory.id);
    }
  };

  const handleToggleActive = (subcategory: Subcategory) => {
    updateMutation.mutate({
      id: subcategory.id,
      data: { is_active: !subcategory.is_active },
    });
  };

  // Filter subcategories by selected category
  const filteredSubcategories = subcategories?.filter(sub =>
    !filterCategoryId || sub.category_id === filterCategoryId
  );

  // Group subcategories by category
  const groupedSubcategories = filteredSubcategories?.reduce((acc, sub) => {
    const catName = sub.category_name || 'Sin categoría';
    if (!acc[catName]) {
      acc[catName] = [];
    }
    acc[catName].push(sub);
    return acc;
  }, {} as Record<string, Subcategory[]>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subcategorías</h1>
          <p className="text-gray-600">
            Administra las subcategorías de productos
          </p>
        </div>
        <Button onClick={openCreateModal} disabled={!categories || categories.length === 0}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Subcategoría
        </Button>
      </div>

      {/* Category Filter */}
      {categories && categories.length > 0 && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">Filtrar por categoría:</span>
          <select
            value={filterCategoryId || ''}
            onChange={(e) => setFilterCategoryId(e.target.value ? Number(e.target.value) : undefined)}
            className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Subcategories List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !categories || categories.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderTree className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay categorías
            </h3>
            <p className="text-gray-500 mb-4">
              Primero debes crear al menos una categoría para poder crear subcategorías
            </p>
          </CardContent>
        </Card>
      ) : groupedSubcategories && Object.keys(groupedSubcategories).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedSubcategories).map(([categoryName, subs]) => (
            <div key={categoryName}>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: categories?.find(c => c.name === categoryName)?.color || '#6b7280' }}
                />
                {categoryName}
              </h3>
              <div className="space-y-2">
                {subs.map((subcategory) => (
                  <Card key={subcategory.id} className={!subcategory.is_active ? 'opacity-60' : ''}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <GripVertical className="h-5 w-5 text-gray-400" />
                          <div
                            className="w-4 h-4 rounded-full border border-gray-200"
                            style={{ backgroundColor: subcategory.color || '#6b7280' }}
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {subcategory.name}
                              </span>
                              {!subcategory.is_active && (
                                <Badge variant="default">Inactiva</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <Package className="h-3.5 w-3.5" />
                              {subcategory.enabled_product_count} habilitados / {subcategory.product_count} total
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(subcategory)}
                          >
                            {subcategory.is_active ? 'Desactivar' : 'Activar'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(subcategory)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(subcategory)}
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
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <FolderTree className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay subcategorías
            </h3>
            <p className="text-gray-500 mb-4">
              Crea tu primera subcategoría para organizar mejor los productos
            </p>
            <Button onClick={openCreateModal}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva Subcategoría
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingSubcategory ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
        size="sm"
      >
        <form onSubmit={handleSubmit}>
          <ModalContent className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Categoría padre
              </label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value={0}>Seleccionar categoría</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <Input
              label="Nombre"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ej: Smartphones"
              required
            />

            <Input
              label="Orden de visualización"
              type="number"
              value={formData.display_order}
              onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
              helperText="Las subcategorías se ordenan de menor a mayor"
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

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="h-4 w-4 text-primary-600 rounded border-gray-300"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">
                Subcategoría activa
              </label>
            </div>
          </ModalContent>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={closeModal}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={createMutation.isPending || updateMutation.isPending}
              disabled={formData.category_id === 0}
            >
              {editingSubcategory ? 'Guardar' : 'Crear'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
