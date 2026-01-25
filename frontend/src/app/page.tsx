'use client';

import { useState } from 'react';
import { Search, Star } from 'lucide-react';
import { ProductGrid } from '@/components/public/ProductGrid';
import { FloatingWhatsAppButton } from '@/components/public/ContactButton';
import { Input } from '@/components/ui/input';
import { usePublicProducts, useCategories } from '@/hooks/useProducts';

export default function HomePage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [showFeatured, setShowFeatured] = useState(false);
  const [page, setPage] = useState(1);

  const { data, isLoading } = usePublicProducts({
    page,
    limit: 20,
    category: showFeatured ? undefined : selectedCategory,
    search: search || undefined,
    featured: showFeatured ? true : undefined,
  });

  const { data: categories } = useCategories();

  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'HeFa - Productos';

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
          {/* Search */}
          <div className="relative max-w-md">
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

          {/* Categories */}
          {categories && categories.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setSelectedCategory(undefined);
                  setShowFeatured(false);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !selectedCategory && !showFeatured
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => {
                  setShowFeatured(true);
                  setSelectedCategory(undefined);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  showFeatured
                    ? 'bg-amber-500 text-white'
                    : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                }`}
              >
                <Star className="h-3.5 w-3.5" />
                Nuevo
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => {
                    setSelectedCategory(category);
                    setShowFeatured(false);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategory === category && !showFeatured
                      ? 'bg-primary-600 text-white'
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
        <ProductGrid products={data?.items || []} isLoading={isLoading} />

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Anterior
            </button>
            <span className="px-4 py-2 text-gray-600">
              Página {page} de {data.pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
              disabled={page === data.pages}
              className="px-4 py-2 border rounded-lg disabled:opacity-50 hover:bg-gray-50"
            >
              Siguiente
            </button>
          </div>
        )}
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
