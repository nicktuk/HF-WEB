'use client';

import { useState } from 'react';
import { Plus, Search, FileDown, ChevronDown, Percent, Power, Star, FolderInput, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductTable } from '@/components/admin/ProductTable';
import { AddProductModal } from '@/components/admin/ProductForm';
import { ManualProductForm } from '@/components/admin/ManualProductForm';
import { BulkMarkupModal } from '@/components/admin/BulkMarkupModal';
import { ActivateInactiveModal } from '@/components/admin/ActivateInactiveModal';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useSourceWebsites, useAdminCategories, useChangeCategorySelected, useChangeSubcategorySelected, useAdminSubcategories } from '@/hooks/useProducts';
import { useAdminFilters } from '@/hooks/useAdminFilters';
import type { Category, Subcategory } from '@/types';
import { adminApi } from '@/lib/api';

export default function ProductsPage() {
  const apiKey = useApiKey() || '';

  // Use persistent filters from store
  const {
    search,
    enabledFilter,
    sourceFilter,
    categoryFilter,
    subcategoryFilter,
    featuredFilter,
    priceRangeFilter,
    page,
    limit,
    setSearch,
    setEnabledFilter,
    setSourceFilter,
    setCategoryFilter,
    setSubcategoryFilter,
    setFeaturedFilter,
    setPriceRangeFilter,
    setPage,
    setLimit,
  } = useAdminFilters();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBulkMarkupModal, setShowBulkMarkupModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkSubcategory, setBulkSubcategory] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const changeCategoryMutation = useChangeCategorySelected(apiKey);
  const changeSubcategoryMutation = useChangeSubcategorySelected(apiKey);

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
    limit,
    enabled: enabledFilter,
    source_website_id: sourceFilter,
    search: search || undefined,
    category: categoryFilter,
    subcategory: subcategoryFilter,
    is_featured: featuredFilter,
    price_range: priceRangeFilter,
  });

  const { data: sourceWebsites } = useSourceWebsites(apiKey);
  const { data: adminCategories } = useAdminCategories();
  const categories = adminCategories as Category[] | undefined;

  // Get subcategories for the selected category
  const selectedCategoryObj = categories?.find(c => c.name === categoryFilter);
  const { data: adminSubcategories } = useAdminSubcategories(selectedCategoryObj?.id);
  const subcategories = adminSubcategories as Subcategory[] | undefined;

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
          {/* Dropdown Acciones */}
          <div className="relative group">
            <Button variant="outline">
              Acciones
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
            <div className="absolute right-0 mt-1 w-56 bg-white border rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <button
                onClick={() => setShowBulkMarkupModal(true)}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 rounded-t-lg flex items-center gap-2"
              >
                <Percent className="h-4 w-4" />
                <div>
                  <p className="font-medium">Markup masivo</p>
                  <p className="text-xs text-gray-500">Aplicar markup a múltiples productos</p>
                </div>
              </button>
              <button
                onClick={() => handleExportPdf('catalog')}
                disabled={isExporting}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2 border-t"
              >
                <FileDown className="h-4 w-4" />
                <div>
                  <p className="font-medium">Exportar PDF (catálogo)</p>
                  <p className="text-xs text-gray-500">Catálogo con imágenes</p>
                </div>
              </button>
              <button
                onClick={() => handleExportPdf('list')}
                disabled={isExporting}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 rounded-b-lg flex items-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                <div>
                  <p className="font-medium">Exportar PDF (lista)</p>
                  <p className="text-xs text-gray-500">Lista de precios simple</p>
                </div>
              </button>
            </div>
          </div>

          {/* Dropdown Agregar Producto */}
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

      {/* Barra contextual de selección */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-blue-900">
              <Check className="h-5 w-5" />
              <span className="font-medium">{selectedIds.length} seleccionados</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setShowActivateModal(true)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Power className="mr-2 h-4 w-4" />
              Activar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCategoryModal(true)}
            >
              <FolderInput className="mr-2 h-4 w-4" />
              Cambiar categoría
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds([])}
              className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
            >
              <X className="h-4 w-4" />
              Deseleccionar
            </Button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            type="search"
            placeholder="Buscar productos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Featured (Nuevos) Filter */}
        <button
          onClick={() => {
            setFeaturedFilter(featuredFilter === true ? undefined : true);
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
              setSelectedIds([]);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Todas las categorias</option>
            <option value="__none__">Sin categoría</option>
            {categories.map((category) => (
              <option key={category.name} value={category.name}>
                {category.name} ({category.enabled_product_count}/{category.product_count})
              </option>
            ))}
          </select>
        )}

        {/* Subcategory Filter - only show when category is selected */}
        {categoryFilter && categoryFilter !== '__none__' && subcategories && subcategories.length > 0 && (
          <select
            value={subcategoryFilter || ''}
            onChange={(e) => {
              setSubcategoryFilter(e.target.value || undefined);
              setSelectedIds([]);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Todas las subcategorias</option>
            <option value="__none__">Sin subcategoría</option>
            {subcategories.map((subcategory) => (
              <option key={subcategory.name} value={subcategory.name}>
                {subcategory.name} ({subcategory.enabled_product_count}/{subcategory.product_count})
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

        {/* Price Range Filter */}
        <select
          value={priceRangeFilter || ''}
          onChange={(e) => {
            setPriceRangeFilter(e.target.value || undefined);
            setSelectedIds([]);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Todos los precios</option>
          <option value="0-5000">$0 - $5.000</option>
          <option value="5001-20000">$5.001 - $20.000</option>
          <option value="20001-80000">$20.001 - $80.000</option>
          <option value="80001+">Mayor a $80.000</option>
        </select>
      </div>

      {/* Results count and per-page selector */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {data && (
            <>
              Mostrando <strong>{data.items.length}</strong> de <strong>{data.total}</strong> productos
              {(search || enabledFilter !== undefined || sourceFilter || categoryFilter || subcategoryFilter || featuredFilter || priceRangeFilter) && (
                <span className="text-primary-600 ml-1">(filtrado)</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Por página:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-primary-500 focus:border-primary-500"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <ProductTable
        products={data?.items || []}
        isLoading={isLoading}
        apiKey={apiKey}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        categories={categories || []}
      />

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            Anterior
          </Button>
          <span className="px-4 py-2 text-gray-600">
            Página {page} de {data.pages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(Math.min(data.pages, page + 1))}
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
          existingMarkup={
            // Find highest markup from selected products
            data?.items
              .filter(p => selectedIds.includes(p.id))
              .reduce((max, p) => Math.max(max, Number(p.markup_percentage) || 0), 0)
          }
          onClose={() => setShowActivateModal(false)}
          onSuccess={() => setSelectedIds([])}
        />
      )}

      {/* Bulk Category Change Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Cambiar categoría</h2>
            <p className="text-sm text-gray-600 mb-4">
              Cambiar la categoría de {selectedIds.length} producto(s) seleccionado(s)
            </p>
            <select
              value={bulkCategory}
              onChange={(e) => setBulkCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Seleccionar categoría</option>
              {categories?.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            {changeCategoryMutation.isError && (
              <p className="text-sm text-red-600 mb-4">Error al cambiar categoría</p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCategoryModal(false);
                  setBulkCategory('');
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={!bulkCategory}
                isLoading={changeCategoryMutation.isPending}
                onClick={async () => {
                  await changeCategoryMutation.mutateAsync({
                    productIds: selectedIds,
                    category: bulkCategory,
                  });
                  setShowCategoryModal(false);
                  setBulkCategory('');
                  setSelectedIds([]);
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
