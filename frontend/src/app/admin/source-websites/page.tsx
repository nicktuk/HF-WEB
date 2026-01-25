'use client';

import { useState } from 'react';
import { Plus, Globe, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useApiKey } from '@/hooks/useAuth';
import { useSourceWebsites } from '@/hooks/useProducts';
import { adminApi } from '@/lib/api';
import type { SourceWebsiteCreateForm } from '@/types';

export default function SourceWebsitesPage() {
  const apiKey = useApiKey() || '';
  const { data, isLoading, refetch } = useSourceWebsites(apiKey);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scrapingId, setScrapingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<SourceWebsiteCreateForm>({
    name: '',
    display_name: '',
    base_url: '',
    is_active: true,
    notes: '',
  });

  const handleScrapeAll = async (id: number) => {
    if (!confirm('Esto va a buscar TODOS los productos del catalogo origen. Los nuevos productos se crearan deshabilitados. Puede tomar varios minutos. Continuar?')) {
      return;
    }

    setScrapingId(id);
    try {
      const result = await adminApi.scrapeAllProducts(apiKey, id, true);
      alert(result.message);
      refetch();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al scrapear');
    } finally {
      setScrapingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await adminApi.createSourceWebsite(apiKey, formData);
      setShowAddModal(false);
      setFormData({
        name: '',
        display_name: '',
        base_url: '',
        is_active: true,
        notes: '',
      });
      refetch();
    } catch (error) {
      alert('Error al crear la web de origen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm('¿Estás seguro de eliminar esta web de origen? Los productos asociados también serán eliminados.')) {
      try {
        await adminApi.deleteSourceWebsite(apiKey, id);
        refetch();
      } catch (error) {
        alert('Error al eliminar');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Webs de Origen</h1>
          <p className="text-gray-600">
            Configura las webs de donde obtienes los productos
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar Web
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : data?.items && data.items.length > 0 ? (
        <div className="grid gap-4">
          {data.items.map((website) => (
            <Card key={website.id}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gray-100 rounded-lg">
                      <Globe className="h-6 w-6 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {website.display_name}
                        </h3>
                        <Badge variant={website.is_active ? 'success' : 'default'}>
                          {website.is_active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {website.base_url}
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        <span className="font-medium">{website.product_count}</span> productos
                      </p>
                      {website.notes && (
                        <p className="text-sm text-gray-500 mt-2">
                          {website.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScrapeAll(website.id)}
                      isLoading={scrapingId === website.id}
                      disabled={scrapingId !== null}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Scrapear Todo
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(website.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
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
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay webs de origen
            </h3>
            <p className="text-gray-500 mb-4">
              Agrega una web de origen para empezar a importar productos
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Web
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Agregar Web de Origen"
        size="md"
      >
        <form onSubmit={handleSubmit}>
          <ModalContent className="space-y-4">
            <Input
              label="Identificador (slug)"
              value={formData.name}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  name: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''),
                })
              }
              placeholder="ej: newredmayorista"
              helperText="Solo minúsculas, números, guiones y guiones bajos"
              required
            />

            <Input
              label="Nombre a mostrar"
              value={formData.display_name}
              onChange={(e) =>
                setFormData({ ...formData, display_name: e.target.value })
              }
              placeholder="ej: New Red Mayorista"
              required
            />

            <Input
              label="URL Base"
              value={formData.base_url}
              onChange={(e) =>
                setFormData({ ...formData, base_url: e.target.value })
              }
              placeholder="https://ejemplo.com"
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notas (opcional)
              </label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                className="block w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
                rows={3}
                placeholder="Notas sobre esta web..."
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) =>
                  setFormData({ ...formData, is_active: e.target.checked })
                }
                className="h-4 w-4 text-primary-600 rounded border-gray-300"
              />
              <label htmlFor="is_active" className="text-sm text-gray-700">
                Activo
              </label>
            </div>
          </ModalContent>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAddModal(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Crear
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
