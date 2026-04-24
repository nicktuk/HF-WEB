'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Search, Star, Zap, Lightbulb, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { HowWeWorkModal } from '@/components/public/HowWeWorkModal';
import { useCategories, useSubcategories } from '@/hooks/useProducts';
import { fetchPublicCatalogSettings } from '@/lib/api';
import { trackPublicEvent } from '@/lib/analytics';
import { useQuery } from '@tanstack/react-query';

function PublicHeaderInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isHome = pathname === '/';

  // URL state
  const searchFromUrl = searchParams.get('search') || '';
  const selectedCategory = searchParams.get('category') || undefined;
  const selectedSubcategory = searchParams.get('subcategory') || undefined;
  const showFeatured = searchParams.get('featured') === 'true';
  const showImmediate = searchParams.get('immediate_delivery') === 'true';
  const showOnDemand = searchParams.get('on_demand') === 'true';
  const sortParam = searchParams.get('sort') || '';

  // Local state
  const [searchInput, setSearchInput] = useState(searchFromUrl);
  const [howWeWorkOpen, setHowWeWorkOpen] = useState(false);

  // Sync search input when URL changes
  useEffect(() => { setSearchInput(searchFromUrl); }, [searchFromUrl]);

  // updateParams: on home update URL in-place, on other pages navigate to home
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
    const base = isHome ? searchParams.toString() : '';
    const params = new URLSearchParams(base);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === '') params.delete(key);
      else params.set(key, value);
    });
    const qs = params.toString();
    const url = qs ? `/?${qs}` : '/';
    if (isHome) router.replace(url, { scroll: false });
    else router.push(url, { scroll: false });
  }, [isHome, searchParams, router, selectedCategory, selectedSubcategory]);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => {
      if (searchInput !== searchFromUrl) {
        updateParams({ search: searchInput || undefined, section_id: undefined });
      }
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Data
  const { data: categories } = useCategories();
  const orderedCategories = [...(categories || [])].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  const { data: subcategories } = useSubcategories(selectedCategory);
  const { data: catalogSettings } = useQuery({
    queryKey: ['public-catalog-settings'],
    queryFn: fetchPublicCatalogSettings,
    staleTime: 5 * 60 * 1000,
  });
  const featuredLabel = catalogSettings?.featured_pill_label || 'Nuevos ingresos';

  const isStaging = process.env.NEXT_PUBLIC_APP_ENV === 'staging';

  return (
    <>
      {/* ─── STAGING BANNER ──────────────────────────────────────────── */}
      {isStaging && (
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 bg-orange-500 py-1 text-xs font-bold uppercase tracking-widest text-white">
          <span>⚠ STAGING</span>
        </div>
      )}

      {/* ─── HEADER ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 header-texture shadow-lg">
        <div className="container mx-auto px-4">
          <div className={`flex flex-col gap-2 ${isStaging ? 'pt-8 pb-2' : 'py-2'}`}>

            {/* Fila 1: logo + acciones */}
            <div className="flex items-center justify-between gap-4">

              {/* Logo */}
              <a href="/" className="flex items-center gap-3 shrink-0">
                <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-lg bg-white/10 border border-white/20">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                </div>
                <div className="flex flex-col leading-none">
                  <span className="text-2xl font-black tracking-[0.18em] text-white">HE·FA</span>
                  <span className="text-[9px] uppercase tracking-[0.22em] text-blue-200/70 font-medium mt-0.5">
                    Productos para el hogar
                  </span>
                </div>
              </a>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setHowWeWorkOpen(true)}
                  className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-all duration-200"
                  aria-label="¿Cómo trabajamos?"
                >
                  <Lightbulb className="h-3.5 w-3.5 text-yellow-300" />
                  <span className="hidden sm:inline">¿Cómo funciona?</span>
                </button>
                <a
                  href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackPublicEvent('whatsapp_click', { metadata: { origin: 'home_header_button' } })}
                  className="hidden sm:inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-green-400 hover:shadow-green-500/40 hover:shadow-lg transition-all duration-200 border border-green-400/50"
                >
                  <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Contactar
                </a>
              </div>
            </div>

            {/* Fila 2: búsqueda */}
            <div className="relative pb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ width: '1rem', height: '1rem', color: 'rgba(255,255,255,0.4)' }} />
              <Input
                type="search"
                placeholder="Buscar productos..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 h-10 w-full rounded-xl border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-white/40 focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>

          </div>
        </div>{/* /container */}
      </header>

      {/* ─── SUBHEADER ────────────────────────────────────────────── */}
      <div className={`sticky z-[39] ${isStaging ? 'top-[128px]' : 'top-[104px]'}`} style={{ backgroundColor: '#162844', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="container mx-auto px-4">
          <div className="flex h-11 items-center gap-2 overflow-x-auto scrollbar-hide">

            {/* Ver todo */}
            <button
              onClick={() => updateParams({ category: undefined, subcategory: undefined, featured: undefined, immediate_delivery: undefined, on_demand: undefined, section_id: undefined })}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                !selectedCategory && !showFeatured && !showImmediate && !showOnDemand
                  ? 'bg-white text-[#0D1B2A]'
                  : 'bg-white/10 text-white/70 border border-white/20 hover:bg-white/20'
              }`}
            >
              Ver todo
            </button>

            {/* Novedades */}
            <button
              onClick={() => updateParams(showFeatured ? { featured: undefined } : { featured: 'true', immediate_delivery: undefined, on_demand: undefined, category: undefined, subcategory: undefined })}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                showFeatured ? 'bg-amber-500 text-white' : 'bg-white/10 text-amber-300 border border-white/20 hover:bg-white/20'
              }`}
            >
              <Star className={`h-3 w-3 ${showFeatured ? 'fill-current' : ''}`} />
              {featuredLabel}
            </button>

            {/* Inmediata */}
            <button
              onClick={() => updateParams(showImmediate ? { immediate_delivery: undefined } : { immediate_delivery: 'true', featured: undefined, on_demand: undefined, category: undefined, subcategory: undefined })}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                showImmediate ? 'bg-emerald-600 text-white' : 'bg-white/10 text-emerald-300 border border-white/20 hover:bg-white/20'
              }`}
            >
              <Zap className={`h-3 w-3 ${showImmediate ? 'fill-current' : ''}`} />
              Inmediata
            </button>

            {/* Por pedido */}
            <button
              onClick={() => updateParams(showOnDemand ? { on_demand: undefined } : { on_demand: 'true', featured: undefined, immediate_delivery: undefined, category: undefined, subcategory: undefined })}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 transition-all ${
                showOnDemand ? 'bg-violet-600 text-white' : 'bg-white/10 text-violet-300 border border-white/20 hover:bg-white/20'
              }`}
            >
              <Package className="h-3 w-3" />
              Por pedido
            </button>

            {/* Category pills */}
            {!selectedCategory && orderedCategories.filter(c => c.show_in_menu).map((category, index) => (
              <button
                key={category.name}
                onClick={() => updateParams({ category: category.name, subcategory: undefined, featured: undefined, immediate_delivery: undefined, section_id: undefined })}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold border transition-all hover:scale-105 animate-attention-pulse"
                style={{ borderColor: category.color, color: category.color, backgroundColor: `${category.color}20`, animationDelay: `${index * 150}ms` }}
              >
                {category.name}
              </button>
            ))}

            {/* Subcategory pills */}
            {selectedCategory && subcategories && subcategories.length > 0 && subcategories.map((sub) => (
              <button
                key={sub.name}
                onClick={() => updateParams({ subcategory: selectedSubcategory === sub.name ? undefined : sub.name })}
                className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-all hover:scale-105"
                style={{
                  backgroundColor: selectedSubcategory === sub.name ? sub.color : `${sub.color}25`,
                  color: selectedSubcategory === sub.name ? 'white' : sub.color,
                  border: `1px solid ${sub.color}60`,
                }}
              >
                {sub.name}
              </button>
            ))}

          </div>
        </div>{/* /container */}
      </div>{/* /subheader */}

      <HowWeWorkModal isOpen={howWeWorkOpen} onClose={() => setHowWeWorkOpen(false)} />
    </>
  );
}

export function PublicHeader() {
  return (
    <Suspense fallback={
      <div className="sticky top-0 z-40 header-texture shadow-lg" style={{ height: '104px' }} />
    }>
      <PublicHeaderInner />
    </Suspense>
  );
}
