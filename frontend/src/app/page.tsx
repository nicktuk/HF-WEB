import { Suspense } from 'react';
import type { Metadata } from 'next';
import { HomePageSkeleton, HomePageContent } from '@/components/public/HomePageClient';

export const metadata: Metadata = {
  title: 'He·Fa Productos | Catálogo de productos para el hogar en Argentina',
  description: 'He·Fa Productos: electrodomésticos, bazar, herramientas y más para el hogar en Argentina. Distribución mayorista y minorista. Consultá nuestro catálogo.',
  alternates: {
    canonical: 'https://www.hefaproductos.com.ar',
  },
};

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}
