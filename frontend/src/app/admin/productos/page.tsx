'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, FileDown, ChevronDown, Percent, Power, PowerOff, Star, FolderInput, Check, X, TrendingUp, Zap, Sparkles, Loader2, Send, Tag, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProductTable } from '@/components/admin/ProductTable';
import { ManualProductForm } from '@/components/admin/ManualProductForm';
import { BulkMarkupModal } from '@/components/admin/BulkMarkupModal';
import { BulkWholesaleMarkupModal } from '@/components/admin/BulkWholesaleMarkupModal';
import { ActivateInactiveModal } from '@/components/admin/ActivateInactiveModal';
import { useApiKey } from '@/hooks/useAuth';
import { useAdminProducts, useAdminCategories, useChangeCategorySelected, useChangeSubcategorySelected, useAdminSubcategories } from '@/hooks/useProducts';
import { useAdminFilters } from '@/hooks/useAdminFilters';
import { useQueryClient } from '@tanstack/react-query';
import type { Category, Subcategory } from '@/types';
import { adminApi, aiApi, AIJobStatus } from '@/lib/api';

export default function ProductsPage() {
  const apiKey = useApiKey() || '';
  const queryClient = useQueryClient();

  // Use persistent filters from store
  const {
    search,
    enabledFilter,
    categoryFilter,
    subcategoryFilter,
    featuredFilter,
    bestSellerFilter,
    immediateDeliveryFilter,
    inStockFilter,
    onSaleFilter,
    inComercioFilter,
    priceRangeFilter,
    sortByFilter,
    page,
    limit,
    setSearch,
    setEnabledFilter,
    setCategoryFilter,
    setSubcategoryFilter,
    setFeaturedFilter,
    setBestSellerFilter,
    setImmediateDeliveryFilter,
    setInStockFilter,
    setOnSaleFilter,
    setInComercioFilter,
    setPriceRangeFilter,
    setSortByFilter,
    setPage,
    setLimit,
  } = useAdminFilters();

  const [showManualModal, setShowManualModal] = useState(false);
  const [showBulkMarkupModal, setShowBulkMarkupModal] = useState(false);
  const [showWholesaleMarkupModal, setShowWholesaleMarkupModal] = useState(false);
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [bulkCategory, setBulkCategory] = useState('');
  const [bulkSubcategory, setBulkSubcategory] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingWholesale, setIsExportingWholesale] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isRemovingBadge, setIsRemovingBadge] = useState(false);
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiJob, setAiJob] = useState<AIJobStatus | null>(null);
  const [showAiModal, setShowAiModal] = useState(false);
  const [isBulkDisabling, setIsBulkDisabling] = useState(false);
  const [isClearingSale, setIsClearingSale] = useState(false);

  const changeCategoryMutation = useChangeCategorySelected(apiKey);
  const changeSubcategoryMutation = useChangeSubcategorySelected(apiKey);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddBadge = async (badge: 'is_featured' | 'is_immediate_delivery' | 'is_best_seller' | 'is_published', productIds: number[]) => {
    setIsRemovingBadge(true);
    try {
      const result = await adminApi.addBadgeBulk(apiKey, badge, productIds);
      showToast(result.message, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch {
      showToast('Error al aplicar marca', 'error');
    } finally {
      setIsRemovingBadge(false);
    }
  };

  const handleRemoveBadge = async (badge: 'is_featured' | 'is_immediate_delivery' | 'is_best_seller' | 'is_published', productIds?: number[]) => {
    setIsRemovingBadge(true);
    try {
      const result = await adminApi.removeBadgeBulk(apiKey, badge, productIds);
      showToast(result.message, 'success');
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (error) {
      showToast('Error al quitar marca', 'error');
    } finally {
      setIsRemovingBadge(false);
    }
  };

  const handleClearSaleSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`¿Quitar el precio de oferta de ${selectedIds.length} producto(s)? Esta acción no se puede deshacer.`)) return;
    setIsClearingSale(true);
    try {
      const result = await adminApi.bulkAction(apiKey, selectedIds, 'clear_sale');
      showToast(result.message, 'success');
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch {
      showToast('Error al quitar ofertas', 'error');
    } finally {
      setIsClearingSale(false);
    }
  };

  const handleCalculateBestSellers = async () => {
    try {
      const result = await adminApi.calculateBestSellers(apiKey, 5);
      showToast(result.message, 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch (error) {
      showToast('Error al calcular mas vendidos', 'error');
    }
  };

  const handleGenerateAI = async () => {
    if (!selectedIds.length) return;
    try {
      const res = await aiApi.generate(apiKey, {
        mode: 'selected',
        product_ids: selectedIds,
        force_regenerate: true,
      });
      setAiJobId(res.job_id);
      setAiJob(null);
      setShowAiModal(true);
    } catch {
      showToast('Error al iniciar la generación de descripciones', 'error');
    }
  };

  // Polling del job de IA
  useEffect(() => {
    if (!aiJobId || !showAiModal) return;
    if (aiJob?.status && aiJob.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const status = await aiApi.getJob(apiKey, aiJobId);
        setAiJob(status);
        if (status.status !== 'running') {
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: ['admin-products'] });
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [aiJobId, showAiModal, aiJob?.status, apiKey, queryClient]);

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

  const handleBulkDisable = async () => {
    if (!selectedIds.length) return;
    if (!confirm(`¿Inactivar ${selectedIds.length} producto(s) seleccionado(s)?`)) return;
    setIsBulkDisabling(true);
    try {
      const res = await adminApi.bulkAction(apiKey, selectedIds, 'disable');
      showToast(res.message || `${selectedIds.length} productos inactivados`, 'success');
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    } catch {
      showToast('Error al inactivar productos', 'error');
    } finally {
      setIsBulkDisabling(false);
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

  const { data: adminCategories } = useAdminCategories();
  const categories = adminCategories as Category[] | undefined;
  const isWithoutCategory = categoryFilter === '__none__';
  const selectedCategoryId =
    categoryFilter && !isWithoutCategory
      ? categories?.find(c => c.name === categoryFilter || String(c.id) === categoryFilter)?.id
      : undefined;
  const selectedCategoryName =
    categoryFilter && !isWithoutCategory
      ? categories?.find(c => c.name === categoryFilter || String(c.id) === categoryFilter)?.name
      : undefined;

  const { data, isLoading } = useAdminProducts(apiKey, {
    page,
    limit,
    enabled: enabledFilter,
    search: search || undefined,
    category_id: selectedCategoryId,
    category: selectedCategoryName,
    without_category: isWithoutCategory ? true : undefined,
    subcategory: subcategoryFilter,
    is_featured: featuredFilter,
    is_immediate_delivery: immediateDeliveryFilter,
    in_stock: inStockFilter,
    is_best_seller: bestSellerFilter,
    on_sale: onSaleFilter,
    in_comercio: inComercioFilter,
    price_range: priceRangeFilter,
    sort_by: sortByFilter,
  });

  useEffect(() => {
    if (!data?.items) return;
    const ids = data.items.map((item) => item.id);
    try {
      sessionStorage.setItem('admin_products_last_list', JSON.stringify(ids));
    } catch {
      // ignore storage errors
    }
  }, [data?.items]);

  // Get subcategories for the selected category
  const selectedCategoryObj = categories?.find(
    c => c.name === categoryFilter || String(c.id) === categoryFilter
  );
  const { data: adminSubcategories } = useAdminSubcategories(selectedCategoryObj?.id);
  const subcategories = adminSubcategories as Subcategory[] | undefined;
  // Get subcategories for bulk change modal
  const bulkCategoryObj = categories?.find(c => c.name === bulkCategory);
  const { data: bulkAdminSubcategories } = useAdminSubcategories(bulkCategoryObj?.id);
  const bulkSubcategories = bulkAdminSubcategories as Subcategory[] | undefined;

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
          <h1 className="text-2xl font-bold text-zinc-900">Productos</h1>
          <p className="text-zinc-600">
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
                onClick={() => setShowBulkMarkupModal(true)}
                className="block w-full text-left px-4 py-3 hover:bg-zinc-100 rounded-t-lg flex items-center gap-2"
              >
                <Percent className="h-4 w-4" />
                <div>
                  <p className="font-medium">Markup masivo</p>
                  <p className="text-xs text-zinc-500">Aplicar markup a mÃºltiples productos</p>
                </div>
              </button>
              <button
                onClick={() => setShowWholesaleMarkupModal(true)}
                className="block w-full text-left px-4 py-3 hover:bg-zinc-100 flex items-center gap-2 border-t"
              >
                <Percent className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">Markup mayorista</p>
                  <p className="text-xs text-zinc-500">Aplica a todos los productos</p>
                </div>
              </button>
              <button
                onClick={() => handleExportPdf('catalog')}
                disabled={isExporting}
                className="block w-full text-left px-4 py-3 hover:bg-zinc-100 flex items-center gap-2 border-t"
              >
                <FileDown className="h-4 w-4" />
                <div>
                  <p className="font-medium">Exportar PDF (catÃ¡logo)</p>
                  <p className="text-xs text-zinc-500">CatÃ¡logo con imÃ¡genes</p>
                </div>
              </button>
              <button
                onClick={() => handleExportPdf('list')}
                disabled={isExporting}
                className="block w-full text-left px-4 py-3 hover:bg-zinc-100 flex items-center gap-2 border-t"
              >
                <FileDown className="h-4 w-4" />
                <div>
                  <p className="font-medium">Exportar PDF (lista)</p>
                  <p className="text-xs text-zinc-500">Lista de precios simple</p>
                </div>
              </button>
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  if (confirm('¿Quitar la marca "Publicar" de todos los productos?')) {
                    handleRemoveBadge('is_published', []);
                  }
                }}
                className="block w-full text-left px-4 py-3 hover:bg-zinc-100 flex items-center gap-2"
              >
                <Send className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="font-medium">Quitar todo publicar</p>
                  <p className="text-xs text-zinc-500">Limpia la marca "Publicar" de todos los productos</p>
                </div>
              </button>
              <div className="border-t my-1" />
              <button
                onClick={handleCalculateBestSellers}
                className="block w-full text-left px-4 py-3 hover:bg-zinc-100 flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="font-medium">Calcular mas vendidos</p>
                  <p className="text-xs text-zinc-500">Marca automatica segun ventas</p>
                </div>
              </button>
              <div className="border-t my-1" />
              <button
                onClick={() => {
                  if (confirm('Quitar marca "Nuevo" de TODOS los productos habilitados?')) {
                    handleRemoveBadge('is_featured');
                  }
                }}
                disabled={isRemovingBadge}
                className="block w-full text-left px-4 py-3 hover:bg-zinc-100 flex items-center gap-2"
              >
                <Star className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-medium">Quitar todos "Nuevo"</p>
                  <p className="text-xs text-zinc-500">Remueve la marca de todos</p>
                </div>
              </button>
              <button
                onClick={() => {
                  if (confirm('Quitar marca "Entrega inmediata" de TODOS los productos habilitados?')) {
                    handleRemoveBadge('is_immediate_delivery');
                  }
                }}
                disabled={isRemovingBadge}
                className="block w-full text-left px-4 py-3 hover:bg-zinc-100 flex items-center gap-2"
              >
                <Zap className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">Quitar todos "Inmediata"</p>
                  <p className="text-xs text-zinc-500">Remueve la marca de todos</p>
                </div>
              </button>
              <button
                onClick={() => {
                  if (confirm('Quitar marca "Mas vendido" de TODOS los productos habilitados?')) {
                    handleRemoveBadge('is_best_seller');
                  }
                }}
                disabled={isRemovingBadge}
                className="block w-full text-left px-4 py-3 hover:bg-zinc-100 rounded-b-lg flex items-center gap-2"
              >
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="font-medium">Quitar todos "Top"</p>
                  <p className="text-xs text-zinc-500">Remueve la marca de todos</p>
                </div>
              </button>
            </div>
          </div>

          <Button onClick={() => setShowManualModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Producto
          </Button>
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
                onClick={handleBulkDisable}
                disabled={isBulkDisabling}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <PowerOff className="mr-2 h-4 w-4" />
                Inactivar
              </Button>
              <Button
                size="sm"
                onClick={handleGenerateAI}
                className="bg-violet-600 hover:bg-violet-700"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Generar con IA
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
                onClick={() => handleAddBadge('is_published', selectedIds)}
                disabled={isRemovingBadge}
                className="border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                <Send className="mr-1 h-4 w-4" />
                Publicar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAddBadge('is_featured', selectedIds)}
                disabled={isRemovingBadge}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Star className="mr-1 h-4 w-4 fill-amber-400" />
                Marcar Nuevo
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
                variant="outline"
                onClick={handleClearSaleSelected}
                disabled={isClearingSale}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                <Tag className="mr-1 h-4 w-4" />
                Quitar oferta
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
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

        {/* Immediate Delivery Filter */}
        <button
          onClick={() => {
            setImmediateDeliveryFilter(immediateDeliveryFilter === true ? undefined : true);
            setSelectedIds([]);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            immediateDeliveryFilter === true
              ? 'bg-emerald-600 text-white'
              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
          }`}
        >
          <Zap className="h-4 w-4" />
          Entrega inmediata
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

        {/* On Sale (Oferta) Filter */}
        <button
          onClick={() => {
            setOnSaleFilter(onSaleFilter === true ? undefined : true);
            setSelectedIds([]);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            onSaleFilter === true
              ? 'bg-red-600 text-white'
              : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
          }`}
        >
          <Tag className="h-4 w-4" />
          En oferta
        </button>

        {/* Comercio Filter */}
        <button
          onClick={() => {
            setInComercioFilter(inComercioFilter === true ? undefined : true);
            setSelectedIds([]);
          }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            inComercioFilter === true
              ? 'bg-blue-600 text-white'
              : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
          }`}
        >
          <Store className="h-4 w-4" />
          Comercio
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
              <option key={category.id} value={String(category.id)}>
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

        {/* Sort Filter */}
        <select
          value={sortByFilter || ''}
          onChange={(e) => {
            setSortByFilter(e.target.value || undefined);
            setSelectedIds([]);
          }}
          className="px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500"
        >
          <option value="">Ordenar por defecto</option>
          <option value="price_asc">Precio: menor a mayor</option>
          <option value="price_desc">Precio: mayor a menor</option>
          <option value="name_asc">Nombre: A → Z</option>
          <option value="name_desc">Nombre: Z → A</option>
        </select>
      </div>

      {/* Results count and per-page selector */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-600">
          {data && (
            <>
              Mostrando <strong>{data.items.length}</strong> de <strong>{data.total}</strong> productos
              {(search || enabledFilter !== undefined || categoryFilter || subcategoryFilter || featuredFilter || bestSellerFilter || immediateDeliveryFilter || inStockFilter || onSaleFilter || inComercioFilter || priceRangeFilter) && (
                <span className="text-primary-600 ml-1">(filtrado)</span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-600">Por pÃ¡gina:</span>
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
          <span className="px-4 py-2 text-zinc-600">
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

      {/* Manual Product Modal */}
      {showManualModal && (
        <ManualProductForm
          onClose={() => setShowManualModal(false)}
          onSuccess={() => setShowManualModal(false)}
          priceAsOriginal
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

      {/* Modal progreso IA */}
      {showAiModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-violet-600 shrink-0" />
              <h2 className="text-lg font-semibold text-zinc-900">Generando descripciones con IA</h2>
            </div>

            {!aiJob ? (
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Iniciando job...
              </div>
            ) : (
              <>
                {/* Barra de progreso */}
                <div>
                  <div className="flex justify-between text-sm text-zinc-600 mb-1">
                    <span>{aiJob.processed} / {aiJob.total} procesados</span>
                    <span>{aiJob.progress_pct}%</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full transition-all duration-500"
                      style={{ width: `${aiJob.progress_pct}%` }}
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-sm">
                  <span className="text-green-700 font-medium">✓ {aiJob.success} ok</span>
                  {aiJob.failed > 0 && (
                    <span className="text-red-600 font-medium">✗ {aiJob.failed} fallidos</span>
                  )}
                  {aiJob.status === 'running' && (
                    <span className="text-zinc-400 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> generando...
                    </span>
                  )}
                  {aiJob.status === 'completed' && (
                    <span className="text-violet-600 font-medium">Completado</span>
                  )}
                  {aiJob.status === 'cancelled' && (
                    <span className="text-zinc-500">Cancelado</span>
                  )}
                </div>

                {/* Últimos resultados */}
                {aiJob.results.length > 0 && (
                  <div className="max-h-40 overflow-y-auto space-y-2 border rounded-lg p-3 bg-zinc-50">
                    {aiJob.results.slice(0, 5).map((r) => (
                      <div key={r.id} className="text-xs">
                        <p className="font-medium text-zinc-700 truncate">{r.name}</p>
                        <p className="text-zinc-500 line-clamp-2">{r.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Errores */}
                {aiJob.errors.length > 0 && (
                  <div className="text-xs text-red-600 space-y-1 max-h-24 overflow-y-auto">
                    {aiJob.errors.map((e) => (
                      <p key={e.id}>{e.name}: {e.error}</p>
                    ))}
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-1">
              {aiJob?.status === 'running' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (aiJobId) await aiApi.cancelJob(apiKey, aiJobId);
                  }}
                >
                  Cancelar
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => {
                  setShowAiModal(false);
                  if (aiJob?.status === 'completed') setSelectedIds([]);
                }}
                disabled={!aiJob || aiJob.status === 'running'}
                variant={aiJob?.status === 'completed' ? 'primary' : 'outline'}
              >
                {aiJob?.status === 'completed' ? 'Listo' : 'Cerrar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Category/Subcategory Change Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Cambiar categorÃ­a y subcategorÃ­a</h2>
            <p className="text-sm text-zinc-600 mb-4">
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
