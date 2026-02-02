'use client';

import { Suspense, useCallback, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search, Star, Zap, Menu, X } from 'lucide-react';
import { ProductGrid } from '@/components/public/ProductGrid';
import { FloatingWhatsAppButton } from '@/components/public/ContactButton';
import { Input } from '@/components/ui/input';
import { usePublicProducts, useCategories } from '@/hooks/useProducts';
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
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">{siteName}</h1>
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
  const showFeatured = searchParams.get('featured') === 'true';
  const showImmediate = searchParams.get('immediate_delivery') === 'true';

  // Local state for search input (for debouncing)
  const [searchInput, setSearchInput] = useState(searchFromUrl);

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Close mobile menu when filter changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [selectedCategory, showFeatured, showImmediate]);

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
    search: searchFromUrl || undefined,
    featured: showFeatured ? true : undefined,
    immediate_delivery: showImmediate ? true : undefined,
  });

  const { data: categories } = useCategories();

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'HeFa - Productos';
  const sortedProducts = (() => {
    const items = data?.items || [];
    if (!selectedCategory || showFeatured || showImmediate) {
      return items;
    }
    return [...items].sort((a, b) => {
      const aImmediate = a.is_immediate_delivery ? 1 : 0;
      const bImmediate = b.is_immediate_delivery ? 1 : 0;
      return bImmediate - aImmediate;
    });
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold text-gray-900">{siteName}</h1>
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
      </header>

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
            {/* Category pill - shows selected category or "Todos" */}
            {selectedCategory ? (
              <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-600 text-white flex items-center gap-1.5">
                {selectedCategory}
                <button
                  onClick={() => updateParams({ category: undefined })}
                  className="hover:bg-blue-700 rounded-full p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-200 text-gray-700">
                Todos
              </span>
            )}
            {/* Nuevo filter pill */}
            <button
              onClick={() => {
                if (showFeatured) {
                  updateParams({ featured: undefined });
                } else {
                  updateParams({ featured: 'true', immediate_delivery: undefined });
                }
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${
                showFeatured
                  ? 'bg-orange-500 text-white'
                  : 'bg-orange-100 text-orange-700 border border-orange-300'
              }`}
            >
              <Star className="h-3.5 w-3.5" />
              Nuevo
            </button>
            {/* Entrega inmediata filter pill */}
            <button
              onClick={() => {
                if (showImmediate) {
                  updateParams({ immediate_delivery: undefined });
                } else {
                  updateParams({ immediate_delivery: 'true', featured: undefined });
                }
              }}
              className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-colors ${
                showImmediate
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 border border-green-300'
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Inmediata
            </button>
          </div>

          {/* Mobile Dropdown Menu */}
          {mobileMenuOpen && categories && categories.length > 0 && (
            <div className="md:hidden bg-white border rounded-lg shadow-lg p-4 space-y-2">
              <button
                onClick={() => {
                  updateParams({ category: undefined, featured: undefined, immediate_delivery: undefined });
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
                  updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined });
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
                  updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined });
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
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      updateParams({ category, featured: undefined, immediate_delivery: undefined });
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedCategory === category && !showFeatured && !showImmediate
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Desktop Categories */}
          {categories && categories.length > 0 && (
            <div className="hidden md:flex flex-wrap gap-2">
              <button
                onClick={() => {
                  updateParams({ category: undefined, featured: undefined, immediate_delivery: undefined });
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
                  updateParams({ featured: 'true', immediate_delivery: undefined, category: undefined });
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
                  updateParams({ immediate_delivery: 'true', featured: undefined, category: undefined });
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
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    updateParams({ category, featured: undefined, immediate_delivery: undefined });
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category && !showFeatured && !showImmediate
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
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
          <ProductGrid products={sortedProducts} isLoading={isLoading} />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {siteName}
        </div>
      </footer>

      {/* Floating WhatsApp Button (mobile) */}
      <FloatingWhatsAppButton />
    </div>
  );
}
