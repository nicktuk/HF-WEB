'use client';

import { Suspense, useCallback, useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Zap, SlidersHorizontal } from 'lucide-react';
import { ProductGrid } from '@/components/public/ProductGrid';
import { FloatingWhatsAppButton } from '@/components/public/ContactButton';
import { HowWeWorkModal } from '@/components/public/HowWeWorkModal';
import { usePublicProducts, useCategories } from '@/hooks/useProducts';
import { ProductCardSkeleton } from '@/components/ui/skeleton';
import { trackPublicEvent } from '@/lib/analytics';
import { fetchPublicCatalogSettings, publicApi, resolveImageUrl } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { SectionCard } from '@/components/public/SectionCard';
import { PublicHeader } from '@/components/public/PublicHeader';

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}

function HomePageSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e0f2fe' }}>
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
  const sortParam = searchParams.get('sort') || undefined;
  const categoriesParam = searchParams.get('categories') || '';
  const multiCategories = categoriesParam ? categoriesParam.split(',') : [];
  // Effective categories: multi-select takes precedence over single pill
  const effectiveCategories = multiCategories.length > 0 ? multiCategories
    : (selectedCategory ? [selectedCategory] : []);

  const [howWeWorkOpen, setHowWeWorkOpen] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const [tempSort, setTempSort] = useState('');
  const [tempCategories, setTempCategories] = useState<string[]>([]);

  useEffect(() => {
    trackPublicEvent('page_view', {
      metadata: { screen: 'home' },
    });
  }, []);

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

  const apiCategory = (!showFeatured && !showImmediate && !selectedSectionId && effectiveCategories.length === 1)
    ? effectiveCategories[0] : undefined;
  const apiSubcategory = (!showFeatured && !showImmediate && !selectedSectionId && effectiveCategories.length === 1)
    ? selectedSubcategory : undefined;

  const { data, isLoading } = usePublicProducts({
    page: 1,
    limit: 1000,
    category: apiCategory,
    subcategory: apiSubcategory,
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

  // Scroll al grid cuando se activa un filtro de sección
  const productGridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedSectionId && productGridRef.current) {
      productGridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedSectionId]);

  const handleSectionSelect = useCallback((section: typeof sectionsArriba[0]) => {
    if (section.criteria_type === 'featured') {
      updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined, subcategory: undefined, section_id: undefined });
    } else if (section.criteria_type === 'immediate_delivery') {
      updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined, subcategory: undefined, section_id: undefined });
    } else if (section.criteria_type === 'category' && section.criteria_value) {
      updateParams({ category: section.criteria_value, subcategory: undefined, featured: undefined, immediate_delivery: undefined, section_id: undefined });
    } else if (section.criteria_type === 'manual' || section.criteria_type === 'best_seller') {
      updateParams({ section_id: String(section.id), category: undefined, subcategory: undefined, featured: undefined, immediate_delivery: undefined });
    }
  }, [updateParams]);

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'HeFa - Productos';
  const sortedProducts = (() => {
    let items = data?.items || [];

    // Client-side multi-category filter
    if (effectiveCategories.length > 1) {
      items = items.filter(p => effectiveCategories.includes(p.category || ''));
    }

    if (sortParam === 'price_asc') return [...items].sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    if (sortParam === 'price_desc') return [...items].sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    if (sortParam === 'name_asc') return [...items].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    if (sortParam === 'name_desc') return [...items].sort((a, b) => b.name.localeCompare(a.name, 'es'));

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

  // Mostrar carrusel y secciones solo cuando no hay ningún filtro activo
  const anyFilterActive = !!(effectiveCategories.length || showFeatured || showImmediate || selectedSectionId || searchFromUrl);
  const showCarousel = !anyFilterActive;
  const showGroupedByCategory = !anyFilterActive && !sortParam;

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
    <div className="relative min-h-screen" style={{ backgroundColor: '#e0f2fe' }}>

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

      {/* ─── HEADER + SUBHEADER ──────────────────────────────────────── */}
      <PublicHeader />


      {/* ─── PRE-GRID GRADIENT ZONE ──────────────────────────────────── */}
      <div
        className="relative z-10"
        style={{ background: 'linear-gradient(to bottom, #fde8d4 0%, #e0f2fe 100%)' }}
      >
        <div className="container mx-auto px-4 pt-3 pb-2">

          {/* ─── CATEGORY CAROUSEL ─────────────────────────────────── */}
          {showCarousel && (
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

          {/* ─── SECTIONS ARRIBA ───────────────────────────────────── */}
          {sectionsArriba.length > 0 && !anyFilterActive && (
            <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 mb-5 h-[280px] sm:h-[400px] lg:h-[440px]">
              <div className="flex gap-3 h-full">
                {sectionsArriba.map(s => (
                  <SectionCard key={s.id} section={s} onSelect={handleSectionSelect} />
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ─── MAIN ────────────────────────────────────────────────────── */}
      <main className="relative z-10 container mx-auto px-4 pb-3">

        {/* ─── MOBILE FILTER BUTTON (md:hidden) ─────────────────────── */}
        <div className="md:hidden flex items-center justify-between pt-3 pb-3">
          <button
            onClick={() => {
              setTempSort(sortParam || '');
              setTempCategories(effectiveCategories);
              setShowMobileFilter(true);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-zinc-200 shadow-sm text-sm font-semibold text-zinc-700"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filtros y orden
            {(effectiveCategories.length > 0 || sortParam) && (
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                {effectiveCategories.length + (sortParam ? 1 : 0)}
              </span>
            )}
          </button>
          {(effectiveCategories.length > 0 || sortParam) && (
            <button
              onClick={() => updateParams({ category: undefined, categories: undefined, sort: undefined, subcategory: undefined })}
              className="text-xs text-zinc-400 hover:text-zinc-600 underline"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* ─── SORT BAR (desktop only) ──────────────────────────────── */}
        <div className="hidden md:flex items-center justify-between mb-4 bg-white/70 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-sm border border-white/60">
          <span className="text-sm text-zinc-500">
            {data && <><strong className="text-zinc-700">{sortedProducts.length}</strong> productos</>}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500">Ordenar:</span>
            <select
              value={sortParam || ''}
              onChange={(e) => updateParams({ sort: e.target.value || undefined })}
              className="text-sm border border-zinc-200 rounded-lg px-3 py-1.5 bg-white text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-400/30 cursor-pointer"
            >
              <option value="">Relevancia</option>
              <option value="price_asc">Precio: menor a mayor</option>
              <option value="price_desc">Precio: mayor a menor</option>
              <option value="name_asc">Nombre: A → Z</option>
              <option value="name_desc">Nombre: Z → A</option>
            </select>
          </div>
        </div>

        {/* ─── PRODUCT GRID ─────────────────────────────────────────── */}
        <div ref={productGridRef}>
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
        {sectionsAbajo.length > 0 && !anyFilterActive && (
          <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 mt-10 h-[280px] sm:h-[400px] lg:h-[440px]">
            <div className="flex gap-3 h-full">
              {sectionsAbajo.map(s => (
                <SectionCard key={s.id} section={s} onSelect={handleSectionSelect} />
              ))}
            </div>
          </div>
        )}

        {/* ─── MOBILE FILTER PANEL (bottom sheet) ───────────────────── */}
        {showMobileFilter && (
          <div className="fixed inset-0 z-50 md:hidden">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileFilter(false)} />
            {/* Sheet */}
            <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[88vh] flex flex-col overflow-hidden">
              {/* Header */}
              <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-zinc-100">
                <span className="text-base font-semibold text-zinc-900">Filtros y orden</span>
                <button onClick={() => setShowMobileFilter(false)} className="text-sm text-zinc-400 hover:text-zinc-600">
                  Cancelar
                </button>
              </div>
              {/* Scrollable content */}
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6 pb-2">
                {/* Sort */}
                <div>
                  <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest mb-3">Ordenar</p>
                  {[
                    { value: '', label: 'Relevancia' },
                    { value: 'price_asc', label: 'Precio: menor a mayor' },
                    { value: 'price_desc', label: 'Precio: mayor a menor' },
                    { value: 'name_asc', label: 'Nombre: A → Z' },
                    { value: 'name_desc', label: 'Nombre: Z → A' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setTempSort(opt.value)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                        tempSort === opt.value ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* Categories checkboxes */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-widest">Categorías</p>
                    {tempCategories.length > 0 && (
                      <button onClick={() => setTempCategories([])} className="text-xs text-zinc-400 hover:text-zinc-600 underline">
                        Limpiar
                      </button>
                    )}
                  </div>
                  {orderedCategories.map((cat) => (
                    <label key={cat.name} className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={tempCategories.includes(cat.name)}
                        onChange={(e) => {
                          setTempCategories(prev =>
                            e.target.checked ? [...prev, cat.name] : prev.filter(c => c !== cat.name)
                          );
                        }}
                        className="w-4 h-4 rounded border-zinc-300 focus:ring-2 focus:ring-blue-500"
                        style={{ accentColor: cat.color }}
                      />
                      <span className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {/* Footer con botón Aplicar */}
              <div className="shrink-0 border-t border-zinc-100 px-4 py-3 bg-white">
                <button
                  onClick={() => {
                    const updates: Record<string, string | undefined> = {};
                    updates.sort = tempSort || undefined;
                    if (tempCategories.length === 0) {
                      updates.category = undefined;
                      updates.categories = undefined;
                    } else if (tempCategories.length === 1) {
                      updates.category = tempCategories[0];
                      updates.categories = undefined;
                      updates.subcategory = undefined;
                    } else {
                      updates.category = undefined;
                      updates.categories = tempCategories.join(',');
                      updates.subcategory = undefined;
                    }
                    if (tempCategories.length > 0) {
                      updates.featured = undefined;
                      updates.immediate_delivery = undefined;
                      updates.section_id = undefined;
                    }
                    updateParams(updates);
                    setShowMobileFilter(false);
                  }}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold"
                >
                  Aplicar filtro
                </button>
              </div>
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


function CategoryCarousel({ slides, onSelect }: { slides: CarouselSlide[]; onSelect: (name: string, filterType: string | null) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);
  // Duplicate slides for seamless infinite loop
  const doubled = [...slides, ...slides];

  useEffect(() => {
    if (slides.length === 0) return;
    const container = scrollRef.current;
    if (!container) return;

    const SPEED = window.innerWidth >= 768 ? 15 : 28; // px/s — slower on desktop
    let lastTime: number | null = null;
    let rafId: number;

    const tick = (timestamp: number) => {
      if (!isPaused.current && container) {
        if (lastTime !== null) {
          const elapsed = Math.min(timestamp - lastTime, 50);
          container.scrollLeft += SPEED * elapsed / 1000;
          if (container.scrollLeft >= container.scrollWidth / 2) {
            container.scrollLeft -= container.scrollWidth / 2;
          }
        }
        lastTime = timestamp;
      } else {
        lastTime = null;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
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
          const imageUrl = resolveImageUrl(slide.carousel_image_url);
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
