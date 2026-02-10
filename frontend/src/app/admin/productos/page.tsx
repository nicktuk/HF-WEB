'use client';

import { useState, useRef, useEffect, type ChangeEvent } from 'react';
import { Plus, Search, FileDown, ChevronDown, Percent, Power, Star, FolderInput, Check, X, TrendingUp, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductTable } from '@/components/admin/ProductTable';
import { AddProductModal } from '@/components/admin/ProductForm';
import { ManualProductForm } from '@/components/admin/ManualProductForm';
import { BulkMarkupModal } from '@/components/admin/BulkMarkupModal';
import { BulkWholesaleMarkupModal } from '@/components/admin/BulkWholesaleMarkupModal';
import { ActivateInactiveModal } from '@/components/admin/ActivateInactiveModal';
import { Modal, ModalContent, ModalFooter } from '@/components/ui/modal';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useSourceWebsites, useAdminCategories, useChangeCategorySelected, useChangeSubcategorySelected, useAdminSubcategories, usePendingPriceChanges, useApprovePendingPriceChanges, useRejectPendingPriceChanges } from '@/hooks/useProducts';
import { useAdminFilters } from '@/hooks/useAdminFilters';
import type { Category, Subcategory } from '@/types';
import { adminApi } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/utils';
import type { StockPreviewResponse } from '@/types';

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
    bestSellerFilter,
    inStockFilter,
    priceRangeFilter,
    page,
    limit,
    setSearch,
    setEnabledFilter,
    setSourceFilter,
    setCategoryFilter,
    setSubcategoryFilter,
    setFeaturedFilter,
    setBestSellerFilter,
    setInStockFilter,
    setPriceRangeFilter,
    setPage,
    setLimit,
  } = useAdminFilters();

  const [showAddModal, setShowAddModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [showBulkMarkupModal, setShowBulkMarkupModal] = useState(false);
  const [showWholesaleMarkupModal, setShowWholesaleMarkupModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkSubcategory, setBulkSubcategory] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWholesale, setIsExportingWholesale] = useState(false);
  const [isImportingStock, setIsImportingStock] = useState(false);
  const [stockImportResult, setStockImportResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
    touched_products: number;
  } | null>(null);
  const [stockPreview, setStockPreview] = useState<StockPreviewResponse | null>(null);
  const [stockPreviewPage, setStockPreviewPage] = useState(1);
  const [stockPreviewFile, setStockPreviewFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showPendingPriceModal, setShowPendingPriceModal] = useState(false);
  const [pendingPriceModalOpened, setPendingPriceModalOpened] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isRemovingBadge, setIsRemovingBadge] = useState(false);
  const [isMarkingNew, setIsMarkingNew] = useState(false);
  const [markNewDate, setMarkNewDate] = useState('');
  const stockFileInputRef = useRef<HTMLInputElement>(null);

  const changeCategoryMutation = useChangeCategorySelected(apiKey);
  const changeSubcategoryMutation = useChangeSubcategorySelected(apiKey);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleRemoveBadge = async (badge: 'is_featured' | 'is_immediate_delivery' | 'is_best_seller', productIds?: number[]) => {
    setIsRemovingBadge(true);
    try {
      const result = await adminApi.removeBadgeBulk(apiKey, badge, productIds);
      showToast(result.message, 'success');
      setSelectedIds([]);
      // Refetch products
      window.location.reload();
    } catch (error) {
      showToast('Error al quitar marca', 'error');
    } finally {
      setIsRemovingBadge(false);
    }
  };

  const handleMarkNewByDate = async () => {
    if (!markNewDate) {
      showToast('Selecciona una fecha', 'error');
      return;
    }
    setIsMarkingNew(true);
    try {
      const result = await adminApi.markNewByDate(apiKey, markNewDate);
      showToast(result.message, 'success');
      setMarkNewDate('');
      window.location.reload();
    } catch (error) {
      showToast('Error al marcar productos', 'error');
    } finally {
      setIsMarkingNew(false);
    }
  };

  const handleCalculateBestSellers = async () => {
    try {
      const result = await adminApi.calculateBestSellers(apiKey, 5);
      showToast(result.message, 'success');
      window.location.reload();
    } catch (error) {
      showToast('Error al calcular mÃ¡s vendidos', 'error');
    }
  };

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

  const handleExportWholesaleSelected = async () => {
    if (!selectedIds.length) return;
    setIsExportingWholesale(true);
    try {
      const blob = await adminApi.exportWholesaleSelected(apiKey, selectedIds);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lista_mayorista_seleccionados.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Error al exportar mayorista');
    } finally {
      setIsExportingWholesale(false);
    }
  };

  const handleImportStockClick = () => {
    stockFileInputRef.current?.click();
  };

  const handleImportStockFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImportingStock(true);
    try {
      const preview = await adminApi.previewStockCsv(apiKey, file);
      setStockPreview(preview);
      setStockPreviewPage(1);
      setStockPreviewFile(file);
    } catch (error) {
      setStockImportResult({
        created: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Error al importar stock'],
        touched_products: 0,
      });
    } finally {
      setIsImportingStock(false);
      if (stockFileInputRef.current) {
        stockFileInputRef.current.value = '';
      }
    }
  };

  const handleConfirmImport = async () => {
    if (!stockPreviewFile) return;
    setIsImportingStock(true);
    try {
      const result = await adminApi.importStockCsv(apiKey, stockPreviewFile);
      setStockImportResult(result);
      setStockPreview(null);
      setStockPreviewFile(null);
    } catch (error) {
      setStockImportResult({
        created: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : 'Error al importar stock'],
        touched_products: 0,
      });
    } finally {
      setIsImportingStock(false);
    }
  };

  const handleDownloadErrors = () => {
    if (!stockImportResult?.errors?.length) return;
    const content = stockImportResult.errors.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'errores-importacion-stock.txt';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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
    in_stock: inStockFilter,
    price_range: priceRangeFilter,
  });

  const { data: pendingPriceChanges } = usePendingPriceChanges(apiKey);
  const approvePendingPrices = useApprovePendingPriceChanges(apiKey);
  const rejectPendingPrices = useRejectPendingPriceChanges(apiKey);

  useEffect(() => {
    if (pendingPriceModalOpened) return;
    if (pendingPriceChanges?.items?.length) {
      setShowPendingPriceModal(true);
      setPendingPriceModalOpened(true);
    }
  }, [pendingPriceChanges, pendingPriceModalOpened]);

  useEffect(() => {
    if (!data?.items) return;
    const ids = data.items.map((item) => item.id);
    try {
      sessionStorage.setItem('admin_products_last_list', JSON.stringify(ids));
    } catch {
      // ignore storage errors
    }
  }, [data?.items]);

  const { data: sourceWebsites } = useSourceWebsites(apiKey);
  const { data: adminCategories } = useAdminCategories();
  const categories = adminCategories as Category[] | undefined;

  // Get subcategories for the selected category
  const selectedCategoryObj = categories?.find(c => c.name === categoryFilter);
  const { data: adminSubcategories } = useAdminSubcategories(selectedCategoryObj?.id);
  const subcategories = adminSubcategories as Subcategory[] | undefined;
  // Get subcategories for bulk change modal
  const bulkCategoryObj = categories?.find(c => c.name === bulkCategory);
  const { data: bulkAdminSubcategories } = useAdminSubcategories(bulkCategoryObj?.id);
  const bulkSubcategories = bulkAdminSubcategories as Subcategory[] | undefined;
  const pendingItems = pendingPriceChanges?.items || [];
  const isPendingAction = approvePendingPrices.isPending || rejectPendingPrices.isPending;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-white shadow-lg ${
          toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Productos</h1>
          <p className="text-gray-600">
            Gestiona los productos de tu catÃ¡logo
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
                onClick={handleImportStockClick}
                disabled={isImportingStock}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 rounded-t-lg flex items-center gap-2"
              >
                <FileDown className="h-4 w-4" />
                <div>
                  <p className="font-medium">Importar stock (CSV)</p>
                  <p className="text-xs text-gray-500">Carga compras y marca entrega inmediata</p>
                </div>
              </button>
              <button
                onClick={() => setShowBulkMarkupModal(true)}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2 border-t"
              >
                <Percent className="h-4 w-4" />
                <div>
                  <p className="font-medium">Markup masivo</p>
                  <p className="text-xs text-gray-500">Aplicar markup a mÃºltiples productos</p>
                </div>
              </button>
              <button
                onClick={() => setShowWholesaleMarkupModal(true)}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2 border-t"
              >
                <Percent className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">Markup mayorista</p>
                  <p className="text-xs text-gray-500">Aplica a todos los productos</p>
                </div>
              </button>
              <button
                onClick={() => handleExportPdf('catalog')}
                disabled={isExporting}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2 border-t"
              >
                <FileDown className="h-4 w-4" />
                <div>
                  <p className="font-medium">Exportar PDF (catÃ¡logo)</p>
                  <p className="text-xs text-gray-500">CatÃ¡logo con imÃ¡genes</p>
                </div>
              </button>
              <button
                onClick={() => handleExportPdf('list')}
                disabled={isExporting}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2 border-t"
              >
                <FileDown className="h-4 w-4" />
                <div>
                  <p className="font-medium">Exportar PDF (lista)</p>
                  <p className="text-xs text-gray-500">Lista de precios simple</p>
                </div>
              </button>
              <div className="border-t my-1" />
              <button
                onClick={handleCalculateBestSellers}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="font-medium">Calcular mas vendidos</p>
                  <p className="text-xs text-gray-500">Marca automatica segun ventas</p>
                </div>
              </button>
              <div className="px-4 py-3 hover:bg-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  <p className="font-medium text-sm">Marcar "Nuevo" por fecha</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={markNewDate}
                    onChange={(e) => setMarkNewDate(e.target.value)}
                    className="flex-1 px-2 py-1 text-sm border rounded"
                  />
                  <Button
                    size="sm"
                    onClick={handleMarkNewByDate}
                    disabled={!markNewDate || isMarkingNew}
                    isLoading={isMarkingNew}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  if (confirm('Quitar marca "Nuevo" de TODOS los productos habilitados?')) {
                    handleRemoveBadge('is_featured');
                  }
                }}
                disabled={isRemovingBadge}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2"
              >
                <Star className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-medium">Quitar todos "Nuevo"</p>
                  <p className="text-xs text-gray-500">Remueve la marca de todos</p>
                </div>
              </button>
              <button
                onClick={() => {
                  if (confirm('Quitar marca "Entrega inmediata" de TODOS los productos habilitados?')) {
                    handleRemoveBadge('is_immediate_delivery');
                  }
                }}
                disabled={isRemovingBadge}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 flex items-center gap-2"
              >
                <Zap className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">Quitar todos "Inmediata"</p>
                  <p className="text-xs text-gray-500">Remueve la marca de todos</p>
                </div>
              </button>
              <button
                onClick={() => {
                  if (confirm('Quitar marca "Mas vendido" de TODOS los productos habilitados?')) {
                    handleRemoveBadge('is_best_seller');
                  }
                }}
                disabled={isRemovingBadge}
                className="block w-full text-left px-4 py-3 hover:bg-gray-100 rounded-b-lg flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="font-medium">Quitar todos "Top"</p>
                  <p className="text-xs text-gray-500">Remueve la marca de todos</p>
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

      {/* Barra contextual de selecciÃ³n */}
      {selectedIds.length > 0 && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-blue-900">
              <Check className="h-5 w-5" />
              <span className="font-medium">{selectedIds.length} seleccionados</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
                Categoria
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportWholesaleSelected}
                disabled={isExportingWholesale}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Exportar mayorista
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRemoveBadge('is_featured', selectedIds)}
                disabled={isRemovingBadge}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Star className="mr-1 h-4 w-4" />
                Quitar Nuevo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRemoveBadge('is_immediate_delivery', selectedIds)}
                disabled={isRemovingBadge}
                className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <Zap className="mr-1 h-4 w-4" />
                Quitar Inmediata
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRemoveBadge('is_best_seller', selectedIds)}
                disabled={isRemovingBadge}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                <TrendingUp className="mr-1 h-4 w-4" />
                Quitar Top
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds([])}
                className="text-blue-700 hover:text-blue-900 hover:bg-blue-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
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

        {/* Best Seller Filter */}
        <button
          onClick={() => {
            setBestSellerFilter(bestSellerFilter === true ? undefined : true);
            setSelectedIds([]);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            bestSellerFilter === true
              ? 'bg-purple-600 text-white'
              : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
          }`}
        >
          <TrendingUp className="h-4 w-4" />
          Mas Vendido
        </button>

        {/* Stock Filter */}
        <button
          onClick={() => {
            setInStockFilter(inStockFilter === true ? undefined : true);
            setSelectedIds([]);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            inStockFilter === true
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          Stock
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
            <option value="__none__">Sin categorÃ­a</option>
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
            <option value="__none__">Sin subcategorÃ­a</option>
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
              {(search || enabledFilter !== undefined || sourceFilter || categoryFilter || subcategoryFilter || featuredFilter || inStockFilter || priceRangeFilter) && (
                <span className="text-primary-600 ml-1">(filtrado)</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Por pÃ¡gina:</span>
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

      <input
        ref={stockFileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleImportStockFile}
      />

      <Modal
        isOpen={!!stockPreview || !!stockImportResult}
        onClose={() => {
          setStockPreview(null);
          setStockImportResult(null);
          setStockPreviewFile(null);
        }}
        title={stockPreview ? 'PrevisualizaciÃ³n de importaciÃ³n de stock' : 'Resumen de importaciÃ³n de stock'}
        size="xl"
      >
        <ModalContent className="space-y-4">
          {stockPreview && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Total</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.total}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">OK</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.ok}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Duplicados</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.duplicate}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Errores</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.error}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Sin match</p>
                  <p className="text-xl font-semibold text-gray-900">{stockPreview.summary.unmatched}</p>
                </div>
              </div>

              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fila</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">CÃƒÂ³digo</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Precio</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Errores</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {stockPreview.rows
                      .slice((stockPreviewPage - 1) * 50, stockPreviewPage * 50)
                      .map((row) => (
                        <tr key={row.row_number} className="hover:bg-gray-50">
                          <td className="px-3 py-2">{row.row_number}</td>
                          <td className="px-3 py-2">{row.product_name || row.description || '-'}</td>
                          <td className="px-3 py-2">
                            {row.code || '-'}
                            {row.derived_code ? <span className="ml-1 text-xs text-gray-400">(derivado)</span> : null}
                          </td>
                          <td className="px-3 py-2 text-right">{row.quantity ?? '-'}</td>
                          <td className="px-3 py-2 text-right">{row.unit_price ?? '-'}</td>
                          <td className="px-3 py-2 text-right">{row.total_amount ?? '-'}</td>
                          <td className="px-3 py-2">
                            {row.status === 'ok' && <span className="text-emerald-700 font-medium">OK</span>}
                            {row.status === 'duplicate' && <span className="text-amber-700 font-medium">Duplicado</span>}
                            {row.status === 'error' && <span className="text-red-600 font-medium">Error</span>}
                            {row.status === 'unmatched' && <span className="text-slate-600 font-medium">Sin match</span>}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600">
                            {row.errors?.length ? row.errors.join('; ') : '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  PÃ¡gina {stockPreviewPage} de {Math.max(1, Math.ceil(stockPreview.rows.length / 50))}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setStockPreviewPage(Math.max(1, stockPreviewPage - 1))}
                    disabled={stockPreviewPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStockPreviewPage(Math.min(Math.ceil(stockPreview.rows.length / 50), stockPreviewPage + 1))}
                    disabled={stockPreviewPage >= Math.ceil(stockPreview.rows.length / 50)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}

          {stockImportResult && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Creados</p>
                  <p className="text-xl font-semibold text-gray-900">{stockImportResult.created}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Omitidos</p>
                  <p className="text-xl font-semibold text-gray-900">{stockImportResult.skipped}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-gray-500 uppercase">Errores</p>
                  <p className="text-xl font-semibold text-gray-900">{stockImportResult.errors?.length || 0}</p>
                </div>
              </div>

              {stockImportResult.errors?.length > 0 && (
                <div className="border rounded-lg">
                  <div className="px-3 py-2 border-b bg-gray-50 text-sm font-medium text-gray-700">
                    Detalle de errores
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {stockImportResult.errors.map((err, idx) => (
                      <div key={idx} className="px-3 py-2 text-sm text-gray-700 border-b last:border-b-0">
                        {err}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </ModalContent>
        <ModalFooter>
          {stockPreview ? (
            <>
              <Button variant="outline" onClick={() => setStockPreview(null)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmImport}
                disabled={(stockPreview.summary.ok + stockPreview.summary.unmatched) === 0 || isImportingStock}
                isLoading={isImportingStock}
              >
                Confirmar importaciÃ³n
              </Button>
            </>
          ) : (
            <>
              {stockImportResult?.errors?.length ? (
                <Button variant="outline" onClick={handleDownloadErrors}>
                  Descargar errores
                </Button>
              ) : null}
              <Button onClick={() => setStockImportResult(null)}>Cerrar</Button>
            </>
          )}
        </ModalFooter>
      </Modal>

      <Modal
        isOpen={showPendingPriceModal}
        onClose={() => setShowPendingPriceModal(false)}
        title="Cambios de precio detectados"
        size="lg"
      >
        <ModalContent className="space-y-4">
          <p className="text-sm text-gray-600">
            Se detectaron cambios de precio origen en productos ya existentes. AprobÃƒÂ¡ para actualizar el precio.
          </p>
          {pendingItems.length === 0 ? (
            <div className="text-sm text-gray-500">No hay cambios pendientes.</div>
          ) : (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actual</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Nuevo</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Detectado</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {pendingItems.map((item) => (
                    <tr key={item.product_id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900 line-clamp-1">
                          {item.display_name}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {item.source_website_name || '-'}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatPrice(item.original_price ?? null)}
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {formatPrice(item.pending_original_price)}
                      </td>
                      <td className="px-3 py-2 text-gray-600">
                        {formatDate(item.detected_at)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => approvePendingPrices.mutateAsync([item.product_id])}
                            disabled={isPendingAction}
                          >
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => rejectPendingPrices.mutateAsync([item.product_id])}
                            disabled={isPendingAction}
                          >
                            Descartar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ModalContent>
        <ModalFooter>
          {pendingItems.length > 0 ? (
            <>
              <Button
                variant="outline"
                onClick={() => rejectPendingPrices.mutateAsync(pendingItems.map((item) => item.product_id))}
                disabled={isPendingAction}
              >
                Descartar todos
              </Button>
              <Button
                onClick={() => approvePendingPrices.mutateAsync(pendingItems.map((item) => item.product_id))}
                disabled={isPendingAction}
              >
                Aprobar todos
              </Button>
            </>
          ) : (
            <Button onClick={() => setShowPendingPriceModal(false)}>Cerrar</Button>
          )}
        </ModalFooter>
      </Modal>

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
            PÃ¡gina {page} de {data.pages}
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

      {/* Bulk Wholesale Markup Modal */}
      {showWholesaleMarkupModal && (
        <BulkWholesaleMarkupModal
          onClose={() => setShowWholesaleMarkupModal(false)}
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

      {/* Bulk Category/Subcategory Change Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Cambiar categorÃ­a y subcategorÃ­a</h2>
            <p className="text-sm text-gray-600 mb-4">
              Cambiar la categorÃ­a/subcategorÃ­a de {selectedIds.length} producto(s) seleccionado(s)
            </p>
            <select
              value={bulkCategory}
              onChange={(e) => {
                setBulkCategory(e.target.value);
                setBulkSubcategory('');
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Seleccionar categorÃ­a</option>
              {categories?.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <select
              value={bulkSubcategory}
              onChange={(e) => setBulkSubcategory(e.target.value)}
              disabled={!bulkCategory || !bulkSubcategories || bulkSubcategories.length === 0}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-4 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Seleccionar subcategorÃ­a</option>
              {bulkSubcategories?.map((sub) => (
                <option key={sub.name} value={sub.name}>
                  {sub.name}
                </option>
              ))}
            </select>
            {changeCategoryMutation.isError && (
              <p className="text-sm text-red-600 mb-4">Error al cambiar categorÃ­a</p>
            )}
            {changeSubcategoryMutation.isError && (
              <p className="text-sm text-red-600 mb-4">Error al cambiar subcategorÃ­a</p>
            )}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCategoryModal(false);
                  setBulkCategory('');
                  setBulkSubcategory('');
                }}
              >
                Cancelar
              </Button>
              <Button
                disabled={!bulkCategory && !bulkSubcategory}
                isLoading={changeCategoryMutation.isPending || changeSubcategoryMutation.isPending}
                onClick={async () => {
                  if (bulkCategory) {
                    await changeCategoryMutation.mutateAsync({
                      productIds: selectedIds,
                      category: bulkCategory,
                    });
                  }
                  if (bulkSubcategory) {
                    await changeSubcategoryMutation.mutateAsync({
                      productIds: selectedIds,
                      subcategory: bulkSubcategory,
                    });
                  }
                  setShowCategoryModal(false);
                  setBulkCategory('');
                  setBulkSubcategory('');
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
