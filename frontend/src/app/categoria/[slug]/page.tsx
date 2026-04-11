import type { Metadata } from 'next';
import CategoryPageClient from '@/components/public/CategoryPageClient';

const SERVER_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1';

const SITE_URL = 'https://www.hefaproductos.com.ar';

async function fetchCategories(): Promise<{ name: string }[]> {
  try {
    const res = await fetch(`${SERVER_API_URL}/public/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  const categories = await fetchCategories();
  return categories.map((c) => ({ slug: encodeURIComponent(c.name) }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const categoryName = decodeURIComponent(params.slug);

  const title = categoryName;
  const description = `Productos de la categoría ${categoryName} en He·Fa Productos. Electrodomésticos, bazar, herramientas y más para el hogar en Argentina.`;
  const url = `${SITE_URL}/categoria/${params.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: 'He·Fa Productos',
      type: 'website',
      locale: 'es_AR',
    },
  };
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
  const categoryName = decodeURIComponent(params.slug);
  return <CategoryPageClient categoryName={categoryName} />;
}
