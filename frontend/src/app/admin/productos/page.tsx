'use client';

import { useState } from 'react';
import { Plus, Search, FileDown, ChevronDown, Percent, Power, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductTable } from '@/components/admin/ProductTable';
import { AddProductModal } from '@/components/admin/ProductForm';
import { ManualProductForm } from '@/components/admin/ManualProductForm';
import { BulkMarkupModal } from '@/components/admin/BulkMarkupModal';
import { ActivateInactiveModal } from '@/components/admin/ActivateInactiveModal';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useSourceWebsites, useCategories } from '@/hooks/useProducts';
import { adminApi } from '@/lib/api';

export default function ProductsPage() {
  const apiKey = useApiKey() || '';

  const [search, setSearch] = useState('');
  const [enabledFilter, setEnabledFilter] = useState<boolean | undefined>();
  const [sourceFilter, setSourceFilter] = useState<number | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [featuredFilter, setFeaturedFilter] = useState<boolean | undefined>();
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBulkMarkupModal, setShowBulkMarkupModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleExportPdf = async (format: 'catalog' | 'list') => {
    setIsExporting(true);
    try {
      const blob = await adminApi.downloadPdf(apiKey, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = format === 'list' ? 'lista_precios.pdf' : 'catalogo.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al exportar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const { data, isLoading } = useAdminProducts(apiKey, {
    page,
    limit: 20,
    enabled: enabledFilter,
    source_website_id: sourceFilter,
    search: search || undefined,
    category: categoryFilter,
    is_featured: featuredFilter,
  });

  const { data: sourceWebsites } = useSourceWebsites(apiKey);
  const { data: categories } = useCategories();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600">
            Gestiona los productos de tu catálogo
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.length > 0 && (
            <Button
              onClick={() => setShowActivateModal(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Power className="mr-2 h-4 w-4" />
              Activar {selectedIds.length} seleccionado(s)
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => setShowBulkMarkupModal(true)}
          >
            <Percent className="mr-2 h-4 w-4" />
            Markup masivo
          </Button>
          <div className="relative group">
            <Button
              variant="outline"
              isLoading={isExporting}
              onClick={() => handleExportPdf('catalog')}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
            <div className="absolute right-0 mt-1 w-48 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => handleExportPdf('catalog')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded-t-lg"
              >
                Catalogo con imagenes
              </button>
              <button
                onClick={() => handleExportPdf('list')}
                className="block w-full text-left px-4 py-2 hover:bg-gray-100 rounded-b-lg"
              >
                Lista de precios simple
              </button>
            </div>
          </div>
          <div className="relative group">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Agregar Producto
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
            <div className="absolute right-0 mt-1 w-56 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => setShowAddModal(true)}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 rounded-t-lg"
              >
                <p className="font-medium">Desde catalogo</p>
                <p className="text-xs text-gray-500">Scrapear de web mayorista</p>
              </button>
              <button
                onClick={() => setShowManualModal(true)}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 rounded-b-lg"
              >
                <p className="font-medium">Producto manual</p>
                <p className="text-xs text-gray-500">Crear desde cero</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="search"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>

        {/* Featured (Nuevos) Filter */}
        <button
          onClick={() => {
            setFeaturedFilter(featuredFilter === true ? undefined : true);
            setPage(1);
            setSelectedIds([]);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            featuredFilter === true
              ? 'bg-amber-500 text-white'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
          }`}
        >
          <Star className="h-4 w-4" />
          Nuevos
        </button>

        {/* Status Filter */}
        <select
          value={enabledFilter === undefined ? '' : enabledFilter.toString()}
          onChange={(e) => {
            const value = e.target.value;
            setEnabledFilter(value === '' ? undefined : value === 'true');
            setPage(1);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Todos los estados</option>
          <option value="true">Habilitados</option>
          <option value="false">Deshabilitados</option>
        </select>

        {/* Category Filter */}
        {categories && categories.length > 0 && (
          <select
            value={categoryFilter || ''}
            onChange={(e) => {
              setCategoryFilter(e.target.value || undefined);
              setPage(1);
              setSelectedIds([]);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Todas las categorias</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        )}

        {/* Source Filter */}
        {sourceWebsites && sourceWebsites.items.length > 1 && (
          <select
            value={sourceFilter || ''}
            onChange={(e) => {
              setSourceFilter(e.target.value ? Number(e.target.value) : undefined);
              setPage(1);
              setSelectedIds([]);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Todas las fuentes</option>
            {sourceWebsites.items.map((website) => (
              <option key={website.id} value={website.id}>
                {website.display_name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Table */}
      <ProductTable
        products={data?.items || []}
        isLoading={isLoading}
        apiKey={apiKey}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="px-4 py-2 text-gray-600">
            Página {page} de {data.pages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page === data.pages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {/* Add Product Modal (Scraping) */}
      <AddProductModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        apiKey={apiKey}
      />

      {/* Manual Product Modal */}
      {showManualModal && (
        <ManualProductForm
          onClose={() => setShowManualModal(false)}
          onSuccess={() => setShowManualModal(false)}
        />
      )}

      {/* Bulk Markup Modal */}
      {showBulkMarkupModal && (
        <BulkMarkupModal
          onClose={() => setShowBulkMarkupModal(false)}
        />
      )}

      {/* Activate Inactive Modal */}
      {showActivateModal && (
        <ActivateInactiveModal
          selectedIds={selectedIds}
          onClose={() => setShowActivateModal(false)}
          onSuccess={() => setSelectedIds([])}
        />
      )}
    </div>
  );
}
