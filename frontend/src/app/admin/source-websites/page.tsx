'use client';

import { useState, useEffect, useRef } from 'react';
import { Plus, Globe, Trash2, RefreshCw, X, CheckCircle, AlertCircle, Loader2, PowerOff } from 'lucide-react';
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

interface ScrapeJob {
  job_id: string;
  source_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  total: number;
  processed: number;
  new_products: number;
  updated: number;
  errors: number;
  obsolete: number;
  progress_percent: number;
  current_product: string;
  started_at: string | null;
  finished_at: string | null;
  error_message: string | null;
}

export default function SourceWebsitesPage() {
  const apiKey = useApiKey() || '';
  const { data, isLoading, refetch } = useSourceWebsites(apiKey);

  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [scrapingId, setScrapingId] = useState<number | null>(null);
  const [disablingId, setDisablingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [currentJob, setCurrentJob] = useState<ScrapeJob | null>(null);
  const [showJobModal, setShowJobModal] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [formData, setFormData] = useState<SourceWebsiteCreateForm>({
    name: '',
    display_name: '',
    base_url: '',
    is_active: true,
    notes: '',
  });

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const pollJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/scrape-jobs/${jobId}`,
        { headers: { 'X-Admin-API-Key': apiKey } }
      );
      if (response.ok) {
        const data = await response.json();
        setCurrentJob(data.job);

        // Stop polling if job is done
        if (['completed', 'failed', 'cancelled'].includes(data.job.status)) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setScrapingId(null);
          refetch();
        }
      }
    } catch (error) {
      console.error('Error polling job status:', error);
    }
  };

  const handleScrapeAll = async (id: number) => {
    if (!confirm('Esto va a buscar TODOS los productos del catalogo origen. Los nuevos productos se crearan deshabilitados y estarán disponibles inmediatamente. ¿Continuar?')) {
      return;
    }

    setScrapingId(id);
    setShowJobModal(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/source-websites/${id}/scrape-job`,
        {
          method: 'POST',
          headers: { 'X-Admin-API-Key': apiKey },
        }
      );

      if (!response.ok) {
        throw new Error('Error al iniciar el scraping');
      }

      const data = await response.json();
      setCurrentJob(data.job);

      // Start polling every 2 seconds
      pollingRef.current = setInterval(() => {
        pollJobStatus(data.job.job_id);
      }, 2000);

    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al scrapear');
      setScrapingId(null);
      setShowJobModal(false);
    }
  };

  const handleCancelJob = async () => {
    if (!currentJob) return;

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/scrape-jobs/${currentJob.job_id}`,
        {
          method: 'DELETE',
          headers: { 'X-Admin-API-Key': apiKey },
        }
      );

      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      setCurrentJob(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setScrapingId(null);
    } catch (error) {
      console.error('Error cancelling job:', error);
    }
  };

  const closeJobModal = () => {
    setShowJobModal(false);
    setCurrentJob(null);
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
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

  const handleDisableAll = async (id: number, displayName: string) => {
    if (!confirm(`¿Deshabilitar TODOS los productos de "${displayName}"? Los productos seguirán existiendo pero no se mostrarán en el catálogo público.`)) {
      return;
    }

    setDisablingId(id);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/source-websites/${id}/disable-all`,
        {
          method: 'POST',
          headers: { 'X-Admin-API-Key': apiKey },
        }
      );

      if (!response.ok) {
        throw new Error('Error al deshabilitar');
      }

      const data = await response.json();
      alert(data.message);
      refetch();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al deshabilitar');
    } finally {
      setDisablingId(null);
    }
  };

  const handleDeleteAllProducts = async (id: number, displayName: string) => {
    if (!confirm(`⚠️ ATENCIÓN: Esto ELIMINARÁ PERMANENTEMENTE todos los productos de "${displayName}". Esta acción no se puede deshacer. ¿Continuar?`)) {
      return;
    }

    // Double confirmation for dangerous action
    if (!confirm(`¿Estás SEGURO? Se eliminarán todos los productos de "${displayName}" de forma permanente.`)) {
      return;
    }

    setDeletingId(id);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/admin/source-websites/${id}/products`,
        {
          method: 'DELETE',
          headers: { 'X-Admin-API-Key': apiKey },
        }
      );

      if (!response.ok) {
        throw new Error('Error al eliminar');
      }

      const data = await response.json();
      alert(data.message);
      refetch();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al eliminar');
    } finally {
      setDeletingId(null);
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
                        <span className="font-medium text-green-600">{website.enabled_product_count}</span> activos / <span className="font-medium">{website.product_count}</span> total
                      </p>
                      {website.notes && (
                        <p className="text-sm text-gray-500 mt-2">
                          {website.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleScrapeAll(website.id)}
                      isLoading={scrapingId === website.id}
                      disabled={scrapingId !== null || disablingId !== null || deletingId !== null}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Scrapear
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisableAll(website.id, website.display_name)}
                      isLoading={disablingId === website.id}
                      disabled={scrapingId !== null || disablingId !== null || deletingId !== null}
                      className="text-orange-600 hover:bg-orange-50"
                    >
                      <PowerOff className="h-4 w-4 mr-1" />
                      Deshabilitar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteAllProducts(website.id, website.display_name)}
                      isLoading={deletingId === website.id}
                      disabled={scrapingId !== null || disablingId !== null || deletingId !== null}
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Eliminar Productos
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(website.id)}
                      title="Eliminar fuente"
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

      {/* Scraping Progress Modal */}
      <Modal
        isOpen={showJobModal}
        onClose={closeJobModal}
        title="Scraping en progreso"
        size="md"
      >
        <ModalContent>
          {currentJob && (
            <div className="space-y-4">
              {/* Status indicator */}
              <div className="flex items-center gap-3">
                {currentJob.status === 'running' && (
                  <Loader2 className="h-6 w-6 text-primary-500 animate-spin" />
                )}
                {currentJob.status === 'completed' && (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                )}
                {currentJob.status === 'failed' && (
                  <AlertCircle className="h-6 w-6 text-red-500" />
                )}
                {currentJob.status === 'cancelled' && (
                  <X className="h-6 w-6 text-gray-500" />
                )}
                <div>
                  <p className="font-medium text-gray-900">
                    {currentJob.status === 'running' && 'Procesando productos...'}
                    {currentJob.status === 'completed' && 'Scraping completado'}
                    {currentJob.status === 'failed' && 'Error en el scraping'}
                    {currentJob.status === 'cancelled' && 'Scraping cancelado'}
                    {currentJob.status === 'pending' && 'Iniciando...'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Fuente: {currentJob.source_name}
                  </p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Progreso</span>
                  <span>{currentJob.processed} / {currentJob.total} ({currentJob.progress_percent}%)</span>
                </div>
                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-300"
                    style={{ width: `${currentJob.progress_percent}%` }}
                  />
                </div>
              </div>

              {/* Current product */}
              {currentJob.status === 'running' && currentJob.current_product && (
                <p className="text-sm text-gray-500 truncate">
                  Procesando: {currentJob.current_product}
                </p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-3 pt-2">
                <div className="text-center p-2 bg-green-50 rounded-lg">
                  <p className="text-xl font-bold text-green-600">{currentJob.new_products}</p>
                  <p className="text-xs text-green-700">Nuevos</p>
                </div>
                <div className="text-center p-2 bg-blue-50 rounded-lg">
                  <p className="text-xl font-bold text-blue-600">{currentJob.updated}</p>
                  <p className="text-xs text-blue-700">Actualizados</p>
                </div>
                <div className="text-center p-2 bg-orange-50 rounded-lg">
                  <p className="text-xl font-bold text-orange-600">{currentJob.obsolete}</p>
                  <p className="text-xs text-orange-700">Obsoletos</p>
                </div>
                <div className="text-center p-2 bg-red-50 rounded-lg">
                  <p className="text-xl font-bold text-red-600">{currentJob.errors}</p>
                  <p className="text-xs text-red-700">Errores</p>
                </div>
              </div>

              {/* Error message */}
              {currentJob.error_message && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-700">{currentJob.error_message}</p>
                </div>
              )}

              {/* Info message */}
              {currentJob.status === 'running' && (
                <p className="text-xs text-gray-500 text-center">
                  Los productos se guardan automáticamente. Puedes cerrar esta ventana y seguirán importándose.
                </p>
              )}
            </div>
          )}
        </ModalContent>

        <ModalFooter>
          {currentJob?.status === 'running' ? (
            <>
              <Button variant="outline" onClick={closeJobModal}>
                Minimizar
              </Button>
              <Button variant="outline" onClick={handleCancelJob} className="text-red-600 hover:bg-red-50">
                Cancelar
              </Button>
            </>
          ) : (
            <Button onClick={closeJobModal}>
              Cerrar
            </Button>
          )}
        </ModalFooter>
      </Modal>
    </div>
  );
}
