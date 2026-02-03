'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, GripVertical, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiKey } from '@/hooks/useAuth';
import type { Category, CategoryCreateForm } from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function fetchCategories(apiKey: string): Promise<Category[]> {
  const res = await fetch(`${API_URL}/categories?include_inactive=true`, {
    headers: { 'X-Admin-API-Key': apiKey },
  });
  if (!res.ok) throw new Error('Error al cargar categorías');
  return res.json();
}

export default function CategoriasPage() {
  const apiKey = useApiKey() || '';
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryCreateForm>({
    name: '',
    is_active: true,
    display_order: 0,
  });

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories', apiKey],
    queryFn: () => fetchCategories(apiKey),
    enabled: !!apiKey,
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

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({ name: '', is_active: true, display_order: 0 });
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      is_active: category.is_active,
      display_order: category.display_order,
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setFormData({ name: '', is_active: true, display_order: 0 });
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
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {category.name}
                        </span>
                        {!category.is_active && (
                          <Badge variant="default">Inactiva</Badge>
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
