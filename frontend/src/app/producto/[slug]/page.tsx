import type { Metadata } from 'next';
import ProductPageClient from '@/components/public/ProductPageClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  try {
    const res = await fetch(`${API_URL}/public/products/${params.slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error('not found');
    const product = await res.json();
    const description =
      product.short_description?.slice(0, 150) ||
      `${product.name} — He·Fa Productos. Productos para el hogar en Argentina.`;
    return {
      title: `${product.name} | He·Fa Productos`,
      description,
      alternates: {
        canonical: `https://www.hefaproductos.com.ar/producto/${params.slug}`,
      },
    };
  } catch {
    return {
      title: 'Producto | He·Fa Productos',
      description: 'He·Fa Productos — Productos para el hogar en Argentina.',
      alternates: {
        canonical: `https://www.hefaproductos.com.ar/producto/${params.slug}`,
      },
    };
  }
}

export default function ProductPage() {
  return <ProductPageClient />;
}
