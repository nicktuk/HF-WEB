'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { PublicHeader } from '@/components/public/PublicHeader';
import { ProductGrid } from '@/components/public/ProductGrid';
import { usePublicProducts } from '@/hooks/useProducts';
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

  const products = data?.items ?? initialProducts ?? [];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e0f2fe' }}>
      <PublicHeader />
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-10">
        <div className="flex items-center gap-2 mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ChevronLeft className="h-4 w-4" />
            Inicio
          </Link>
          <span className="text-gray-400">/</span>
          <span className="text-sm font-medium text-gray-700">{categoryName}</span>
        </div>

        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-6">{categoryName}</h1>

        <ProductGrid products={products} isLoading={isLoading} twoColumnsMobile />
      </main>
    </div>
  );
}
