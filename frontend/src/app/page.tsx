'use client';

import { Suspense, useCallback, useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Star, Zap, Menu, X, ChevronLeft, Lightbulb } from 'lucide-react';
import { ProductGrid } from '@/components/public/ProductGrid';
import { FloatingWhatsAppButton } from '@/components/public/ContactButton';
import { HowWeWorkModal } from '@/components/public/HowWeWorkModal';
import { Input } from '@/components/ui/input';
import { usePublicProducts, useCategories, useSubcategories } from '@/hooks/useProducts';
import { ProductCardSkeleton } from '@/components/ui/skeleton';

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageSkeleton() {
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'HeFa - Productos';
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900">{siteName}</h1>
              <span className="text-sm text-gray-500">Catálogo de productos</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="h-9 w-24 sm:w-36 bg-gray-200 rounded-lg animate-pulse" />
              <div className="hidden sm:block h-9 w-28 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 space-y-4">
          <div className="h-10 w-full max-w-md bg-gray-200 rounded-lg animate-pulse" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-20 bg-gray-200 rounded-full animate-pulse" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read state from URL params
  const searchFromUrl = searchParams.get('search') || '';
  const selectedCategory = searchParams.get('category') || undefined;
  const selectedSubcategory = searchParams.get('subcategory') || undefined;
  const showFeatured = searchParams.get('featured') === 'true';
  const showImmediate = searchParams.get('immediate_delivery') === 'true';

  // Local state for search input (for debouncing)
  const [searchInput, setSearchInput] = useState(searchFromUrl);

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // 'categories' shows main categories, 'subcategories' shows subcategories of selected category
  const [mobileMenuMode, setMobileMenuMode] = useState<'categories' | 'subcategories'>('categories');
  // Temporary category selection for drill-down (before applying filter)
  const [tempCategory, setTempCategory] = useState<string | null>(null);

  // How We Work modal state
  const [howWeWorkOpen, setHowWeWorkOpen] = useState(false);


  // Sync local state when URL changes externally
  useEffect(() => {
    setSearchInput(searchFromUrl);
  }, [searchFromUrl]);

  // Debounce search - only update URL after user stops typing
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchInput !== searchFromUrl) {
        const params = new URLSearchParams(searchParams.toString());
        if (searchInput) {
          params.set('search', searchInput);
        } else {
          params.delete('search');
        }
        const queryString = params.toString();
        router.push(queryString ? `/?${queryString}` : '/', { scroll: false });
      }
    }, 400); // 400ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchInput, searchFromUrl, searchParams, router]);

  // Reset mobile menu mode when menu closes or category filter changes
  useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileMenuMode('categories');
      setTempCategory(null);
    }
  }, [mobileMenuOpen]);

  // Close mobile menu when filter changes (except when drilling down)
  useEffect(() => {
    if (selectedSubcategory || showFeatured || showImmediate) {
      setMobileMenuOpen(false);
    }
  }, [selectedSubcategory, showFeatured, showImmediate]);

  // Helper to update URL params
  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    router.push(queryString ? `/?${queryString}` : '/', { scroll: false });
  }, [searchParams, router]);

  const { data, isLoading } = usePublicProducts({
    page: 1,
    limit: 1000, // Load all products without pagination
    category: showFeatured || showImmediate ? undefined : selectedCategory,
    subcategory: showFeatured || showImmediate ? undefined : selectedSubcategory,
    search: searchFromUrl || undefined,
    featured: showFeatured ? true : undefined,
    immediate_delivery: showImmediate ? true : undefined,
  });

  const { data: categories } = useCategories();
  const orderedCategories = useMemo(() => {
    return (categories || [])
      .map((category, index) => ({ category, index }))
      .sort((a, b) => {
        const aOrder = Number.isFinite(a.category.display_order) ? a.category.display_order : null;
        const bOrder = Number.isFinite(b.category.display_order) ? b.category.display_order : null;
        if (aOrder !== null && bOrder !== null && aOrder !== bOrder) {
          return aOrder - bOrder;
        }
        // Fallback: preserve backend response order.
        return a.index - b.index;
      })
      .map(({ category }) => category);
  }, [categories]);
  // Load subcategories for the selected category (URL) or temp category (drill-down menu)
  const { data: subcategories } = useSubcategories(selectedCategory);
  const { data: tempSubcategories } = useSubcategories(tempCategory || undefined);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'HeFa - Productos';
  const sortedProducts = (() => {
    const items = data?.items || [];
    if (showFeatured || showImmediate) {
      return items;
    }

    const categoryOrder = new Map(
      orderedCategories.map((category, index) => [category.name, category.display_order ?? index]),
    );

    return [...items].sort((a, b) => {
      const aCategoryOrder = categoryOrder.get(a.category || '') ?? Number.POSITIVE_INFINITY;
      const bCategoryOrder = categoryOrder.get(b.category || '') ?? Number.POSITIVE_INFINITY;
      if (aCategoryOrder !== bCategoryOrder) {
        return aCategoryOrder - bCategoryOrder;
      }

      const aPrice = a.price ?? Number.POSITIVE_INFINITY;
      const bPrice = b.price ?? Number.POSITIVE_INFINITY;
      if (aPrice !== bPrice) {
        return aPrice - bPrice;
      }

      return a.name.localeCompare(b.name, 'es');
    });
  })();

  const showGroupedByCategory = !selectedCategory && !showFeatured && !showImmediate;

  const groupedProducts = useMemo(() => {
    if (!showGroupedByCategory) {
      return [];
    }

    const categoryMeta = new Map(
      orderedCategories.map((category, index) => [
        category.name,
        {
          order: Number.isFinite(category.display_order) ? category.display_order : index,
          color: category.color || '#6b7280',
        },
      ]),
    );

    const grouped = new Map<string, typeof sortedProducts>();
    sortedProducts.forEach((product) => {
      const categoryName = (product.category || '').trim() || 'Sin categoria';
      const current = grouped.get(categoryName) || [];
      current.push(product);
      grouped.set(categoryName, current);
    });

    return Array.from(grouped.entries())
      .map(([name, products], index) => {
        const meta = categoryMeta.get(name);
        return {
          name,
          color: meta?.color || '#6b7280',
          order: meta?.order ?? (1000 + index),
          products,
        };
      })
      .sort((a, b) => (a.order - b.order) || a.name.localeCompare(b.name, 'es'));
  }, [showGroupedByCategory, orderedCategories, sortedProducts]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-gray-900">{siteName}</h1>
              <span className="text-sm text-gray-500">Catálogo de productos</span>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* WhatsApp Contact Button - Desktop */}
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Contactar
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Banner informativo debajo del header */}
      <div className="container mx-auto px-4 py-3">
        <button
          onClick={() => setHowWeWorkOpen(true)}
          className="w-full text-left text-sm font-semibold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 hover:bg-blue-100 transition-colors flex items-center gap-3"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white shadow-md flex-shrink-0">
            <Lightbulb className="h-4 w-4 animate-pulse" />
          </span>
          <span>¿Primera vez comprando con nosotros? Te contamos acá</span>
        </button>
      </div>

      {/* Main */}
      <main className="container mx-auto px-4 py-6">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search and Mobile Menu Button */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="search"
                placeholder="Buscar productos..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
              aria-label="Abrir menú de categorías"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {/* Filters Pills (Mobile) */}
          <div className="flex flex-wrap gap-2 md:hidden">
            {/* Category pill - only show when neither "Nuevo" nor "Inmediata" are active */}
            {!showFeatured && !showImmediate && (
              <>
                {selectedCategory ? (
                  <span
                    className="px-3 py-1.5 rounded-full text-sm font-medium text-white shadow-sm flex items-center gap-1.5"
                    style={{
                      backgroundColor: orderedCategories.find(c => c.name === selectedCategory)?.color || '#3b82f6'
                    }}
                  >
                    {selectedCategory}
                    <button
                      onClick={() => updateParams({ category: undefined, subcategory: undefined })}
                      className="hover:opacity-80 rounded-full p-0.5 transition-colors"
                      aria-label="Quitar filtro de categoría"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-200 text-gray-700">
                    Todos
                  </span>
                )}
                {/* Subcategory pill */}
                {selectedSubcategory && (
                  <span
                    className="px-3 py-1.5 rounded-full text-sm font-medium text-white shadow-sm flex items-center gap-1.5"
                    style={{
                      backgroundColor: subcategories?.find(s => s.name === selectedSubcategory)?.color || '#6b7280'
                    }}
                  >
                    {selectedSubcategory}
                    <button
                      onClick={() => updateParams({ subcategory: undefined })}
                      className="hover:opacity-80 rounded-full p-0.5 transition-colors"
                      aria-label="Quitar filtro de subcategoría"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                )}
              </>
            )}
            {/* Nuevo filter pill */}
            <button
              onClick={() => {
                if (showFeatured) {
                  updateParams({ featured: undefined });
                } else {
                  updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined });
                }
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all ${
                showFeatured
                  ? 'bg-orange-500 text-white shadow-md border-2 border-orange-600 hover:bg-orange-600'
                  : 'bg-white text-orange-700 border-2 border-orange-200 hover:border-orange-300 hover:bg-orange-50'
              }`}
              aria-pressed={showFeatured}
              aria-label={showFeatured ? 'Desactivar filtro Nuevo' : 'Activar filtro Nuevo'}
            >
              <Star className={`h-3.5 w-3.5 ${showFeatured ? 'fill-current' : ''}`} />
              Nuevo
            </button>
            {/* Entrega inmediata filter pill */}
            <button
              onClick={() => {
                if (showImmediate) {
                  updateParams({ immediate_delivery: undefined });
                } else {
                  updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined });
                }
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all ${
                showImmediate
                  ? 'bg-green-600 text-white shadow-md border-2 border-green-700 hover:bg-green-700'
                  : 'bg-white text-green-700 border-2 border-green-200 hover:border-green-300 hover:bg-green-50'
              }`}
              aria-pressed={showImmediate}
              aria-label={showImmediate ? 'Desactivar filtro Entrega inmediata' : 'Activar filtro Entrega inmediata'}
            >
              <Zap className={`h-3.5 w-3.5 ${showImmediate ? 'fill-current' : ''}`} />
              Inmediata
            </button>
            {/* Category pills for show_in_menu categories - only when no category selected */}
            {!selectedCategory && orderedCategories.filter(c => c.show_in_menu).map((category, index) => (
              <button
                key={category.name}
                onClick={() => {
                  updateParams({ category: category.name, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
                }}
                className={`relative px-3 py-1.5 rounded-full text-sm font-medium transition-all animate-attention-pulse border-2 hover:scale-105`}
                style={{
                  backgroundColor: 'white',
                  borderColor: category.color,
                  color: category.color,
                  animationDelay: `${index * 150}ms`,
                }}
              >
                {category.name}
              </button>
            ))}
            {/* Subcategory pills - only when category selected */}
            {selectedCategory && subcategories && subcategories.length > 0 && subcategories.map((subcategory) => (
              <button
                key={subcategory.name}
                onClick={() => {
                  if (selectedSubcategory === subcategory.name) {
                    updateParams({ subcategory: undefined });
                  } else {
                    updateParams({ subcategory: subcategory.name });
                  }
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                  selectedSubcategory === subcategory.name
                    ? 'text-white shadow-md'
                    : 'border-2 hover:scale-105'
                }`}
                style={{
                  backgroundColor: selectedSubcategory === subcategory.name
                    ? subcategory.color
                    : 'white',
                  borderColor: subcategory.color,
                  color: selectedSubcategory === subcategory.name
                    ? 'white'
                    : subcategory.color,
                }}
              >
                {subcategory.name}
              </button>
            ))}
          </div>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && orderedCategories.length > 0 && (
            <div className="md:hidden bg-white border rounded-lg shadow-lg p-4 space-y-2">
              {mobileMenuMode === 'categories' ? (
                <>
                  {/* Categories View */}
                  <button
                    onClick={() => {
                      updateParams({ category: undefined, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      !selectedCategory && !showFeatured && !showImmediate
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => {
                      updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined, subcategory: undefined });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      showFeatured
                        ? 'bg-orange-100 text-orange-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Star className="h-4 w-4" />
                    Nuevo
                  </button>
                  <button
                    onClick={() => {
                      updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined, subcategory: undefined });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                      showImmediate
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                    Entrega inmediata
                  </button>
                  <div className="border-t pt-2 mt-2">
                    <p className="text-xs text-gray-500 mb-2 px-3">Categorías</p>
                    {orderedCategories.map((category) => (
                      <button
                        key={category.name}
                        onClick={() => {
                          // Drill-down: show subcategories for this category
                          setTempCategory(category.name);
                          setMobileMenuMode('subcategories');
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                          selectedCategory === category.name && !showFeatured && !showImmediate
                            ? 'text-white'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                        style={{
                          backgroundColor: selectedCategory === category.name && !showFeatured && !showImmediate
                            ? category.color
                            : undefined,
                        }}
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  {/* Subcategories View (drill-down) */}
                  <button
                    onClick={() => {
                      setMobileMenuMode('categories');
                      setTempCategory(null);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Volver a categorías
                  </button>

                  <div className="border-t pt-2 mt-2">
                    {/* Header showing current category */}
                    <div
                      className="px-3 py-2 rounded-lg mb-2 flex items-center gap-2"
                      style={{
                        backgroundColor: `${orderedCategories.find(c => c.name === tempCategory)?.color}20`,
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: orderedCategories.find(c => c.name === tempCategory)?.color }}
                      />
                      <span
                        className="text-sm font-semibold"
                        style={{ color: orderedCategories.find(c => c.name === tempCategory)?.color }}
                      >
                        {tempCategory}
                      </span>
                    </div>

                    {/* "All in category" button */}
                    <button
                      onClick={() => {
                        updateParams({ category: tempCategory || undefined, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors text-gray-700 hover:bg-gray-50"
                    >
                      Ver todo en {tempCategory}
                    </button>

                    {/* Subcategories list */}
                    {tempSubcategories && tempSubcategories.length > 0 ? (
                      <>
                        <p className="text-xs text-gray-500 mb-2 px-3 mt-3">Subcategorías</p>
                        {tempSubcategories.map((subcategory) => (
                          <button
                            key={subcategory.name}
                            onClick={() => {
                              updateParams({
                                category: tempCategory || undefined,
                                subcategory: subcategory.name,
                                featured: undefined,
                                immediate_delivery: undefined
                              });
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                              selectedSubcategory === subcategory.name
                                ? 'text-white'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                            style={{
                              backgroundColor: selectedSubcategory === subcategory.name
                                ? subcategory.color
                                : undefined,
                            }}
                          >
                            <span
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: subcategory.color }}
                            />
                            {subcategory.name}
                          </button>
                        ))}
                      </>
                    ) : (
                      <p className="text-xs text-gray-400 px-3 mt-2">
                        No hay subcategorías
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Desktop Categories */}
          {orderedCategories.length > 0 && (
            <div className="hidden md:flex flex-wrap gap-2">
              <button
                onClick={() => {
                  updateParams({ category: undefined, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !selectedCategory && !showFeatured && !showImmediate
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => {
                  updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined, subcategory: undefined });
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  showFeatured
                    ? 'bg-orange-500 text-white'
                    : 'bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200'
                }`}
              >
                <Star className="h-3.5 w-3.5" />
                Nuevo
              </button>
              <button
                onClick={() => {
                  updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined, subcategory: undefined });
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  showImmediate
                    ? 'bg-green-600 text-white shadow-sm'
                    : 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                }`}
              >
                <Zap className="h-3.5 w-3.5" />
                Entrega inmediata
              </button>
              {orderedCategories.map((category) => (
                <button
                  key={category.name}
                  onClick={() => {
                    if (selectedCategory === category.name) {
                      updateParams({ category: undefined, subcategory: undefined });
                    } else {
                      updateParams({ category: category.name, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category.name && !showFeatured && !showImmediate
                      ? 'text-white'
                      : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: selectedCategory === category.name && !showFeatured && !showImmediate
                      ? category.color
                      : `${category.color}20`,
                    color: selectedCategory === category.name && !showFeatured && !showImmediate
                      ? 'white'
                      : category.color,
                  }}
                >
                  {category.name}
                </button>
              ))}
            </div>
          )}

          {/* Desktop Subcategories - only when category selected */}
          {selectedCategory && subcategories && subcategories.length > 0 && !showFeatured && !showImmediate && (
            <div className="hidden md:flex flex-wrap gap-2 pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-500 py-1.5">Subcategorías:</span>
              {subcategories.map((subcategory) => (
                <button
                  key={subcategory.name}
                  onClick={() => {
                    if (selectedSubcategory === subcategory.name) {
                      updateParams({ subcategory: undefined });
                    } else {
                      updateParams({ subcategory: subcategory.name });
                    }
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedSubcategory === subcategory.name
                      ? 'text-white'
                      : 'hover:opacity-80'
                  }`}
                  style={{
                    backgroundColor: selectedSubcategory === subcategory.name
                      ? subcategory.color
                      : `${subcategory.color}20`,
                    color: selectedSubcategory === subcategory.name
                      ? 'white'
                      : subcategory.color,
                  }}
                >
                  {subcategory.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Grid */}
        <div>
          {showImmediate && (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Entrega inmediata
                  </p>
                  <p className="text-xs text-emerald-700">
                    Productos listos para retirar o enviar sin demoras.
                  </p>
                </div>
              </div>
            </div>
          )}
          {showGroupedByCategory ? (
            groupedProducts.length === 0 ? (
              <ProductGrid products={[]} isLoading={isLoading} />
            ) : (
              <div className="space-y-8">
                {groupedProducts.map((group) => (
                  <section key={group.name} className="space-y-4">
                    <div
                      className="w-full rounded-xl border px-4 py-2"
                      style={{
                        backgroundColor: `${group.color}1A`,
                        borderColor: `${group.color}66`,
                      }}
                    >
                      <p
                        className="text-sm font-semibold uppercase tracking-wide"
                        style={{ color: group.color }}
                      >
                        {group.name}
                      </p>
                    </div>
                    <ProductGrid products={group.products} />
                  </section>
                ))}
              </div>
            )
          ) : (
            <ProductGrid products={sortedProducts} isLoading={isLoading} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {siteName}
        </div>
      </footer>

      {/* How We Work Modal */}
      <HowWeWorkModal isOpen={howWeWorkOpen} onClose={() => setHowWeWorkOpen(false)} />

      {/* Floating WhatsApp Button (mobile) */}
      <FloatingWhatsAppButton />
    </div>
  );
}
