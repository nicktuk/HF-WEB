'use client';

import { Suspense, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Star, Zap, Menu, X, ChevronLeft, Lightbulb } from 'lucide-react';
import { ProductGrid } from '@/components/public/ProductGrid';
import { FloatingWhatsAppButton } from '@/components/public/ContactButton';
import { HowWeWorkModal } from '@/components/public/HowWeWorkModal';
import { Input } from '@/components/ui/input';
import { usePublicProducts, useCategories, useSubcategories } from '@/hooks/useProducts';
import { ProductCardSkeleton } from '@/components/ui/skeleton';
import { trackPublicEvent } from '@/lib/analytics';
import { fetchPublicCatalogSettings, publicApi } from '@/lib/api';
import type { Category } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { SectionStrip } from '@/components/public/SectionStrip';
import { SectionCard } from '@/components/public/SectionCard';

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageSkeleton() {
  return (
    <div className="min-h-screen bg-dot-pattern" style={{ backgroundColor: '#f7f4ef' }}>
      <header className="sticky top-0 z-40 header-texture">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-[0.18em] text-white leading-none">HE·FA</span>
                <span className="text-[9px] uppercase tracking-[0.22em] text-brand-300 leading-none mt-1 font-medium">
                  Productos para el hogar
                </span>
              </div>
            </div>
            <div className="hidden h-9 w-32 rounded-full bg-white/10 animate-pulse sm:block" />
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <div className="mb-6 space-y-4">
          <div className="h-11 w-full max-w-md bg-white/80 rounded-xl animate-pulse shadow-sm" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-20 bg-white/80 rounded-full animate-pulse shadow-sm" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5">
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
  const selectedSectionId = searchParams.get('section_id') ? Number(searchParams.get('section_id')) : undefined;

  // Local state for search input (for debouncing)
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const lastTrackedSearchRef = useRef<string>('');

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

  useEffect(() => {
    if (!searchInput.trim()) {
      lastTrackedSearchRef.current = '';
    }
  }, [searchInput]);

  useEffect(() => {
    trackPublicEvent('page_view', {
      metadata: { screen: 'home' },
    });
  }, []);

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
        // Use replace to avoid polluting history while typing.
        router.replace(queryString ? `/?${queryString}` : '/', { scroll: false });

        const searchTerm = searchInput.trim().toLowerCase();
        // Track only meaningful, stable searches (avoid partial keystrokes noise).
        if (searchTerm.length >= 3 && searchTerm !== lastTrackedSearchRef.current) {
          lastTrackedSearchRef.current = searchTerm;
          trackPublicEvent('search', {
            search_query: searchInput.trim(),
            category: selectedCategory,
            subcategory: selectedSubcategory,
          });
        }
      }
    }, 900); // more forgiving debounce for typing

    return () => clearTimeout(timeoutId);
  }, [searchInput, searchFromUrl, searchParams, router, selectedCategory, selectedSubcategory]);

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
    if (updates.category && updates.category !== selectedCategory) {
      trackPublicEvent('category_click', { category: updates.category });
    }
    if (updates.subcategory && updates.subcategory !== selectedSubcategory) {
      trackPublicEvent('subcategory_click', {
        category: updates.category ?? selectedCategory,
        subcategory: updates.subcategory,
      });
    }

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
  }, [searchParams, router, selectedCategory, selectedSubcategory]);

  const { data, isLoading } = usePublicProducts({
    page: 1,
    limit: 1000,
    category: (showFeatured || showImmediate || selectedSectionId) ? undefined : selectedCategory,
    subcategory: (showFeatured || showImmediate || selectedSectionId) ? undefined : selectedSubcategory,
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

  // Si la categoría seleccionada en el menú no tiene subs, filtrar directamente
  useEffect(() => {
    if (mobileMenuMode === 'subcategories' && tempCategory && Array.isArray(tempSubcategories) && tempSubcategories.length === 0) {
      updateParams({ category: tempCategory, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
      setMobileMenuOpen(false);
      setMobileMenuMode('categories');
      setTempCategory(null);
    }
  }, [tempSubcategories, mobileMenuMode, tempCategory]);

  const { data: catalogSettings } = useQuery({
    queryKey: ['public-catalog-settings'],
    queryFn: fetchPublicCatalogSettings,
    staleTime: 5 * 60 * 1000,
  });
  const featuredLabel = catalogSettings?.featured_pill_label || 'Nuevos ingresos';

  const { data: sections } = useQuery({
    queryKey: ['public-sections'],
    queryFn: () => publicApi.getSections(),
    staleTime: 5 * 60 * 1000,
  });

  const sectionsArriba = sections?.filter(s => s.position === 'arriba') ?? [];
  const sectionsAbajo = sections?.filter(s => s.position === 'abajo') ?? [];

  // Accent color for the background gradient (driven by active filter)
  const accentColor = useMemo(() => {
    if (selectedCategory) {
      return orderedCategories.find(c => c.name === selectedCategory)?.color ?? '#94a3b8';
    }
    if (showFeatured) return '#f59e0b';
    if (showImmediate) return '#10b981';
    return '#94a3b8';
  }, [selectedCategory, orderedCategories, showFeatured, showImmediate]);

  // Products for a manual section selected via section_id param
  const selectedSection = selectedSectionId ? sections?.find(s => s.id === selectedSectionId) : undefined;
  const sectionProducts = selectedSection?.products ?? [];

  const handleSectionSelect = useCallback((section: typeof sectionsArriba[0]) => {
    if (section.criteria_type === 'featured') {
      updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined, subcategory: undefined, section_id: undefined });
    } else if (section.criteria_type === 'immediate_delivery') {
      updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined, subcategory: undefined, section_id: undefined });
    } else if (section.criteria_type === 'category' && section.criteria_value) {
      updateParams({ category: section.criteria_value, subcategory: undefined, featured: undefined, immediate_delivery: undefined, section_id: undefined });
    } else if (section.criteria_type === 'manual') {
      updateParams({ section_id: String(section.id), category: undefined, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
    }
  }, [updateParams]);

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

  const showGroupedByCategory = !selectedCategory && !showFeatured && !showImmediate && !selectedSectionId;

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
      const categoryName = (product.category || '').trim();
      if (!categoryName || !categoryMeta.has(categoryName)) {
        return;
      }
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
    <div className="relative min-h-screen bg-dot-pattern" style={{ backgroundColor: '#f7f4ef' }}>

      {/* ─── ACCENT GRADIENT (tints behind header + carousel + sections) ── */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{
          height: '640px',
          background: `linear-gradient(to bottom, ${accentColor}28 0%, ${accentColor}18 45%, transparent 100%)`,
          zIndex: 0,
          transition: 'background 0.6s ease',
        }}
      />

      {/* ─── HEADER ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 header-texture shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between gap-4">

            {/* Logo */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Icon mark */}
              <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 border border-white/20">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                </svg>
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-2xl font-black tracking-[0.18em] text-white">
                  HE·FA
                </span>
                <span className="text-[9px] uppercase tracking-[0.22em] text-blue-200/70 font-medium mt-0.5">
                  Productos para el hogar
                </span>
              </div>
            </div>

            {/* Actions — desktop */}
            <div className="flex items-center gap-2 shrink-0">
              {/* ¿Primera vez? */}
              <button
                onClick={() => setHowWeWorkOpen(true)}
                className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-all duration-200"
                aria-label="¿Cómo trabajamos?"
              >
                <Lightbulb className="h-3.5 w-3.5 text-yellow-300" />
                <span className="hidden sm:inline">¿Cómo funciona?</span>
              </button>

              {/* WhatsApp CTA */}
              <a
                href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPublicEvent('whatsapp_click', { metadata: { origin: 'home_header_button' } })}
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-green-400 hover:shadow-green-500/40 hover:shadow-lg transition-all duration-200 border border-green-400/50"
              >
                <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Contactar
              </a>
            </div>
          </div>
        </div>
      </header>



      {/* ─── MAIN ────────────────────────────────────────────────────── */}
      <main className="relative z-10 container mx-auto px-4 py-3">

        {/* Search and Filters — sticky below header */}
        <div className="sticky top-16 z-30 filter-bar-glass -mx-4 px-4 pb-3 pt-3 mb-5 space-y-3">

          {/* Search and Mobile Menu Button */}
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-zinc-400 pointer-events-none" style={{ width: '1.1rem', height: '1.1rem' }} />
              <Input
                type="search"
                placeholder="Buscar productos..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10 h-10 rounded-xl border-zinc-200 bg-white shadow-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
              />
            </div>
            {/* Ver todo pill */}
            <button
              onClick={() => updateParams({ category: undefined, subcategory: undefined, featured: undefined, immediate_delivery: undefined })}
              className={`hidden md:flex items-center px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                !selectedCategory && !showFeatured && !showImmediate
                  ? 'bg-[#0D1B2A] text-white shadow-sm'
                  : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 shadow-sm'
              }`}
            >
              Ver todo
            </button>
            {/* Subcategory pills — desktop */}
            {selectedCategory && subcategories && subcategories.length > 0 && !showFeatured && !showImmediate && (
              <>
                <span className="hidden md:block w-px h-6 bg-zinc-300 self-center" />
                {subcategories.map((sub) => (
                  <button
                    key={sub.name}
                    onClick={() => updateParams({ subcategory: selectedSubcategory === sub.name ? undefined : sub.name })}
                    className="hidden md:flex items-center px-3 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-105"
                    style={{
                      backgroundColor: selectedSubcategory === sub.name ? sub.color : `${sub.color}18`,
                      color: selectedSubcategory === sub.name ? 'white' : sub.color,
                    }}
                  >
                    {sub.name}
                  </button>
                ))}
              </>
            )}
            {/* Menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 transition-colors font-medium text-sm text-zinc-700"
              aria-label="Abrir menú de categorías"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              {!mobileMenuOpen && <span className="text-xs">Filtros</span>}
            </button>
          </div>

          {/* ── Active filter pills ── */}
          <div className="flex flex-wrap gap-2 md:hidden">
            {!showFeatured && !showImmediate && (
              <>
                {selectedCategory ? (
                  <span
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-sm flex items-center gap-1.5"
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
                  <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-zinc-200 text-zinc-700">
                    Todos
                  </span>
                )}
                {selectedSubcategory && (
                  <span
                    className="px-3 py-1.5 rounded-full text-xs font-semibold text-white shadow-sm flex items-center gap-1.5"
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

            {/* Novedades pill */}
            <button
              onClick={() => {
                if (showFeatured) {
                  updateParams({ featured: undefined });
                } else {
                  updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined });
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showFeatured
                  ? 'bg-amber-500 text-white shadow-md border-2 border-amber-600 hover:bg-amber-600'
                  : 'bg-white text-amber-700 border-2 border-amber-200 hover:border-amber-300 hover:bg-amber-50'
              }`}
              aria-pressed={showFeatured}
              aria-label={showFeatured ? `Desactivar filtro ${featuredLabel}` : `Activar filtro ${featuredLabel}`}
            >
              <Star className={`h-3.5 w-3.5 ${showFeatured ? 'fill-current' : ''}`} />
              {featuredLabel}
            </button>

            {/* Entrega inmediata pill */}
            <button
              onClick={() => {
                if (showImmediate) {
                  updateParams({ immediate_delivery: undefined });
                } else {
                  updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined });
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all ${
                showImmediate
                  ? 'bg-emerald-600 text-white shadow-md border-2 border-emerald-700 hover:bg-emerald-700'
                  : 'bg-white text-emerald-700 border-2 border-emerald-200 hover:border-emerald-300 hover:bg-emerald-50'
              }`}
              aria-pressed={showImmediate}
              aria-label={showImmediate ? 'Desactivar filtro Entrega inmediata' : 'Activar filtro Entrega inmediata'}
            >
              <Zap className={`h-3.5 w-3.5 ${showImmediate ? 'fill-current' : ''}`} />
              Inmediata
            </button>

            {/* Category pills for show_in_menu categories */}
            {!selectedCategory && orderedCategories.filter(c => c.show_in_menu).map((category, index) => (
              <button
                key={category.name}
                onClick={() => {
                  updateParams({ category: category.name, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
                }}
                className="relative px-3 py-1.5 rounded-full text-xs font-semibold transition-all animate-attention-pulse border-2 hover:scale-105"
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

            {/* Subcategory pills */}
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
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
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

          {/* ── Dropdown Menu ── */}
          {mobileMenuOpen && orderedCategories.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-2xl shadow-xl p-4 space-y-1">
              {mobileMenuMode === 'categories' ? (
                <>
                  <button
                    onClick={() => {
                      updateParams({ category: undefined, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      !selectedCategory && !showFeatured && !showImmediate
                        ? 'bg-zinc-100 text-zinc-900'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    Todos los productos
                  </button>
                  <button
                    onClick={() => {
                      updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined, subcategory: undefined });
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                      showFeatured
                        ? 'bg-amber-50 text-amber-700 font-semibold'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <Star className="h-4 w-4" />
                    {featuredLabel}
                  </button>
                  <button
                    onClick={() => {
                      updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined, subcategory: undefined });
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                      showImmediate
                        ? 'bg-emerald-50 text-emerald-700 font-semibold'
                        : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    <Zap className="h-4 w-4" />
                    Entrega inmediata
                  </button>
                  <div className="border-t border-zinc-100 pt-2 mt-2">
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 px-3">Categorías</p>
                    {orderedCategories.map((category) => (
                      <button
                        key={category.name}
                        onClick={() => {
                          setTempCategory(category.name);
                          setMobileMenuMode('subcategories');
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2.5 ${
                          selectedCategory === category.name && !showFeatured && !showImmediate
                            ? 'text-white'
                            : 'text-zinc-700 hover:bg-zinc-50'
                        }`}
                        style={{
                          backgroundColor: selectedCategory === category.name && !showFeatured && !showImmediate
                            ? category.color
                            : undefined,
                        }}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setMobileMenuMode('categories');
                      setTempCategory(null);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-zinc-700 hover:bg-zinc-50 flex items-center gap-2"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Volver a categorías
                  </button>

                  <div className="border-t border-zinc-100 pt-2 mt-1">
                    <div
                      className="px-3 py-2 rounded-xl mb-2 flex items-center gap-2"
                      style={{
                        backgroundColor: `${orderedCategories.find(c => c.name === tempCategory)?.color}18`,
                      }}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: orderedCategories.find(c => c.name === tempCategory)?.color }}
                      />
                      <span
                        className="text-sm font-bold"
                        style={{ color: orderedCategories.find(c => c.name === tempCategory)?.color }}
                      >
                        {tempCategory}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        updateParams({ category: tempCategory || undefined, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-zinc-700 hover:bg-zinc-50"
                    >
                      Ver todo en {tempCategory}
                    </button>

                    {tempSubcategories && tempSubcategories.length > 0 ? (
                      <>
                        <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-2 px-3 mt-3">Subcategorías</p>
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
                            className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2.5 ${
                              selectedSubcategory === subcategory.name
                                ? 'text-white'
                                : 'text-zinc-700 hover:bg-zinc-50'
                            }`}
                            style={{
                              backgroundColor: selectedSubcategory === subcategory.name
                                ? subcategory.color
                                : undefined,
                            }}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: subcategory.color }}
                            />
                            {subcategory.name}
                          </button>
                        ))}
                      </>
                    ) : (
                      <p className="text-xs text-zinc-400 px-3 mt-2">
                        No hay subcategorías
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

        </div>

        {/* ─── SECTIONS ARRIBA ─────────────────────────────────────── */}
        {sectionsArriba.length > 0 && (
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 mb-5">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {sectionsArriba.map(s => (
                <SectionCard key={s.id} section={s} onSelect={handleSectionSelect} />
              ))}
            </div>
          </div>
        )}

        {/* ─── CATEGORY CAROUSEL ───────────────────────────────────── */}
        {showGroupedByCategory && (
          <CategoryCarousel
            slides={orderedCategories.filter(c => c.show_in_carousel)}
            onSelect={(name, filterType) => {
              if (filterType === 'immediate_delivery') {
                updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined, subcategory: undefined });
              } else if (filterType === 'featured') {
                updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined, subcategory: undefined });
              } else {
                updateParams({ category: name, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
              }
            }}
          />
        )}

        {/* ─── PRODUCT GRID ─────────────────────────────────────────── */}
        <div>
          {selectedSectionId && selectedSection && (
            <div className="mb-5 rounded-2xl px-5 py-4 shadow-sm flex items-center justify-between"
              style={{ backgroundColor: selectedSection.bg_color || '#0D1B2A' }}>
              <p className="text-sm font-bold" style={{ color: selectedSection.text_color || '#fff' }}>
                {selectedSection.title}
              </p>
              <button
                onClick={() => updateParams({ section_id: undefined })}
                className="text-xs opacity-70 hover:opacity-100 font-semibold"
                style={{ color: selectedSection.text_color || '#fff' }}
              >
                × Ver todo
              </button>
            </div>
          )}
          {showImmediate && (
            <div className="mb-5 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-emerald-50 px-5 py-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-emerald-800">
                    Entrega inmediata
                  </p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Productos listos para retirar o enviar sin demoras.
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedSectionId ? (
            <ProductGrid products={sectionProducts as any} isLoading={false} />
          ) : showGroupedByCategory ? (
            groupedProducts.length === 0 ? (
              <ProductGrid products={[]} isLoading={isLoading} />
            ) : (
              <div className="space-y-10">
                {groupedProducts.map((group) => (
                  <section key={group.name} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span
                        className="h-5 w-0.5 shrink-0 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      <p
                        className="shrink-0 text-xs font-semibold uppercase tracking-widest"
                        style={{ color: group.color }}
                      >
                        {group.name}
                      </p>
                      <span
                        className="h-px flex-1"
                        style={{ backgroundColor: `${group.color}33` }}
                      />
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

        {/* ─── SECTIONS ABAJO ──────────────────────────────────────── */}
        {sectionsAbajo.length > 0 && (
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 mt-10">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {sectionsAbajo.map(s => (
                <SectionCard key={s.id} section={s} onSelect={handleSectionSelect} />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="mt-16 bg-[#0D1B2A]">
        {/* Top accent line */}
        <div className="h-1 bg-gradient-to-r from-primary-600 via-primary-400 to-primary-600" />

        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            {/* Brand column */}
            <div className="sm:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/20">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                </div>
                <span className="text-xl font-black tracking-[0.18em] text-white">HE·FA</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Distribuidora mayorista y minorista de productos para el hogar. Electrodomésticos, bazar, herramientas y más.
              </p>
            </div>

            {/* Contact column */}
            <div className="sm:col-span-1">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Contacto</h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackPublicEvent('whatsapp_click', { metadata: { origin: 'footer' } })}
                    className="flex items-center gap-2.5 text-sm text-zinc-400 hover:text-green-400 transition-colors group"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 text-green-500 group-hover:bg-green-500/20 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </span>
                    WhatsApp
                  </a>
                </li>
              </ul>
            </div>

            {/* Info column */}
            <div className="sm:col-span-1">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Información</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setHowWeWorkOpen(true)}
                    className="text-sm text-zinc-400 hover:text-white transition-colors text-left"
                  >
                    ¿Cómo funciona?
                  </button>
                </li>
                <li>
                  <span className="text-sm text-zinc-500">
                    Zona: Argentina
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} {siteName}. Todos los derechos reservados.
            </p>
            <p className="text-xs text-zinc-600">
              Distribución mayorista · Argentina
            </p>
          </div>
        </div>
      </footer>

      {/* How We Work Modal */}
      <HowWeWorkModal isOpen={howWeWorkOpen} onClose={() => setHowWeWorkOpen(false)} />

      {/* Floating WhatsApp Button (mobile) */}
      <FloatingWhatsAppButton />
    </div>
  );
}

type CarouselSlide = { name: string; color: string; show_in_carousel: boolean; carousel_title: string | null; carousel_subtitle: string | null; carousel_image_url: string | null; carousel_bg_color: string | null; carousel_text_color: string | null; carousel_font: string | null; carousel_filter_type: string | null; carousel_glow: boolean; carousel_glow_color: string | null; display_order: number; show_in_menu: boolean; };

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace('/api/v1', '');

function fixImageUrl(url: string | null): string | null {
  if (!url) return null;
  return url.replace(/^http:\/\/localhost:\d+/, API_BASE);
}

function CategoryCarousel({ slides, onSelect }: { slides: CarouselSlide[]; onSelect: (name: string, filterType: string | null) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);
  // Duplicate slides for seamless infinite loop
  const doubled = [...slides, ...slides];

  useEffect(() => {
    if (slides.length === 0) return;
    const container = scrollRef.current;
    if (!container) return;

    const STEP = 1;
    const INTERVAL = 16;

    const tick = () => {
      if (isPaused.current || !container) return;
      container.scrollLeft += STEP;
      // When we've scrolled past the first copy, jump back silently
      if (container.scrollLeft >= container.scrollWidth / 2) {
        container.scrollLeft -= container.scrollWidth / 2;
      }
    };

    const id = setInterval(tick, INTERVAL);
    return () => clearInterval(id);
  }, [slides.length]);

  if (slides.length === 0) return null;

  return (
    <div
      ref={scrollRef}
      className="mb-6 -mx-4 px-4 overflow-x-auto scrollbar-hide"
      onMouseEnter={() => { isPaused.current = true; }}
      onMouseLeave={() => { isPaused.current = false; }}
      onTouchStart={() => { isPaused.current = true; }}
      onTouchEnd={() => { isPaused.current = false; }}
    >
      <div className="flex gap-3 pb-2" style={{ width: 'max-content' }}>
        {doubled.map((slide, i) => {
          const fontMap = { sans: 'font-sans', serif: 'font-serif', mono: 'font-mono' };
          const fontClass = fontMap[slide.carousel_font as keyof typeof fontMap] ?? 'font-sans';
          const bgColor = slide.carousel_bg_color || slide.color || '#0D1B2A';
          const textColor = slide.carousel_text_color || '#ffffff';
          const title = slide.carousel_title || slide.name;
          const imageUrl = fixImageUrl(slide.carousel_image_url);
          const glowColor = slide.carousel_glow_color || '#ffffff';
          return (
            <div
              key={`${slide.name}-${i}`}
              className={`shrink-0 rounded-2xl ${slide.carousel_glow ? 'animate-glow-pulse' : ''}`}
              style={{
                width: '240px',
                boxShadow: slide.carousel_glow
                  ? `0 0 0 4px ${glowColor}, 0 0 20px 4px ${glowColor}99, 0 0 45px 8px ${glowColor}55`
                  : undefined,
              }}
            >
            <button
              type="button"
              onClick={() => onSelect(slide.name, slide.carousel_filter_type ?? null)}
              className={`relative w-full rounded-2xl overflow-hidden transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 h-[280px] sm:h-[400px] lg:h-[440px] ${fontClass}`}
              style={{ backgroundColor: bgColor }}
              aria-label={`Filtrar por categoría: ${title}`}
            >
              {imageUrl && (
                <img
                  src={imageUrl}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              )}
              {imageUrl ? (
                <div className="absolute inset-0 bg-black/45" />
              ) : (
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.4) 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                />
              )}
              <div className="relative z-10 flex flex-col justify-end h-full p-4 text-left">
                <span className="text-sm font-bold leading-tight line-clamp-2" style={{ color: textColor }}>
                  {title}
                </span>
                {slide.carousel_subtitle && (
                  <span className="text-xs mt-1 leading-tight line-clamp-1 opacity-80" style={{ color: textColor }}>
                    {slide.carousel_subtitle}
                  </span>
                )}
              </div>
            </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
