'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PublicHeader } from '@/components/public/PublicHeader';
import { ProductGrid } from '@/components/public/ProductGrid';
import { usePublicProducts, useCategories } from '@/hooks/useProducts';
import type { ProductPublic } from '@/types';

interface CategoryPageClientProps {
  categoryName: string;
  initialProducts?: ProductPublic[];
}

export default function CategoryPageClient({ categoryName, initialProducts }: CategoryPageClientProps) {
  const { data, isLoading } = usePublicProducts({
    category: categoryName,
    limit: 200,
  });

  const { data: categories } = useCategories();
  const categoryColor = categories?.find(c => c.name === categoryName)?.color ?? '#3b82f6';

  const products = data?.items ?? initialProducts ?? [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e0f2fe' }}>
      <PublicHeader />

      {/* Category title bar — sticky below header */}
      <div
        className="sticky z-[38] shadow-sm"
        style={{ top: '147px', backgroundColor: categoryColor }}
      >
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-3 py-2.5">
            <Link
              href="/"
              className="flex items-center gap-1 text-xs font-medium text-white/70 hover:text-white transition-colors shrink-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Inicio
            </Link>
            <span className="text-white/50 text-xs">/</span>
            <h1 className="text-sm font-bold text-white tracking-wide truncate">{categoryName}</h1>
            <span
              className="ml-auto shrink-0 text-xs font-medium text-white/70"
            >
              {products.length > 0 ? `${products.length} productos` : ''}
            </span>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 pb-24 md:pb-10">
        <ProductGrid products={products} isLoading={isLoading} twoColumnsMobile />
      </main>
    </div>
  );
}
