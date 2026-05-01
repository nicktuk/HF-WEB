import type { Metadata } from 'next';
import CategoryPageClient from '@/components/public/CategoryPageClient';
import { slugifyCategory } from '@/lib/utils';
import type { ProductPublic, PaginatedResponse } from '@/types';

const SERVER_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1';

const SITE_URL = 'https://www.hefaproductos.com.ar';

const slugify = slugifyCategory;

const LOCAL_SUFFIX = 'Envíos a Ezeiza, Canning, Monte Grande y GBA Sur.';

// Keys are slugified category names (e.g. "audio-y-tv")
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'audio-y-tv': `Audio y TV al mejor precio: parlantes, auriculares, televisores, home theater y accesorios. He·Fa Productos. ${LOCAL_SUFFIX}`,
  'electrodomesticos': `Electrodomésticos para el hogar: heladeras, lavarropas, microondas, ventiladores y más. He·Fa Productos. ${LOCAL_SUFFIX}`,
  'bazar': `Artículos de bazar y cocina: ollas, sartenes, vajilla, utensilios y accesorios para el hogar. He·Fa Productos. ${LOCAL_SUFFIX}`,
  'bazar-y-cocina': `Artículos de bazar y cocina: ollas, sartenes, vajilla, utensilios y accesorios para el hogar. He·Fa Productos. ${LOCAL_SUFFIX}`,
  'herramientas': `Herramientas manuales y eléctricas para el hogar y la obra. Calidad y precio en He·Fa Productos. ${LOCAL_SUFFIX}`,
  'iluminacion': `Iluminación LED, lámparas, tiras y accesorios para el hogar. Ahorrá energía con He·Fa Productos. ${LOCAL_SUFFIX}`,
  'jardin': `Artículos de jardín y exterior: mangueras, macetas, herramientas de jardinería y más. He·Fa Productos. ${LOCAL_SUFFIX}`,
  'limpieza': `Productos de limpieza para el hogar: baldes, trapos, escobas, organizadores y más. He·Fa Productos. ${LOCAL_SUFFIX}`,
  'textil': `Textiles para el hogar: sábanas, toallas, almohadas, acolchados y más en He·Fa Productos. ${LOCAL_SUFFIX}`,
  'juguetes': `Juguetes y artículos infantiles a precios accesibles en He·Fa Productos. ${LOCAL_SUFFIX}`,
  'electronica': `Electrónica y tecnología: cables, cargadores, auriculares y accesorios para el hogar. He·Fa Productos. ${LOCAL_SUFFIX}`,
  'ferreteria': `Artículos de ferretería: tornillos, pegamentos, herramientas y fijaciones. He·Fa Productos. ${LOCAL_SUFFIX}`,
  'decoracion': `Decoración para el hogar: cuadros, floreros, velas, espejos y accesorios decorativos. He·Fa Productos. ${LOCAL_SUFFIX}`,
  'bano': `Accesorios de baño: dispensadores, porta-rollos, alfombras y organizadores. He·Fa Productos. ${LOCAL_SUFFIX}`,
};

function getCategoryDescription(categoryName: string): string {
  const key = slugify(categoryName);
  if (CATEGORY_DESCRIPTIONS[key]) return CATEGORY_DESCRIPTIONS[key];
  for (const [pattern, desc] of Object.entries(CATEGORY_DESCRIPTIONS)) {
    if (key.includes(pattern) || pattern.includes(key)) return desc;
  }
  return `${categoryName} para el hogar en He·Fa Productos. Amplio catálogo con envíos. ${LOCAL_SUFFIX}`;
}

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

async function fetchProductsByCategory(category: string): Promise<ProductPublic[]> {
  try {
    const params = new URLSearchParams({ category, limit: '200' });
    const res = await fetch(`${SERVER_API_URL}/public/products?${params}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data: PaginatedResponse<ProductPublic> = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  const categories = await fetchCategories();
  return categories.map((c) => ({ slug: slugify(c.name) }));
}

async function resolveCategoryName(slug: string): Promise<string> {
  const categories = await fetchCategories();
  return categories.find((c) => slugify(c.name) === slug)?.name ?? slug;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const categoryName = await resolveCategoryName(params.slug);

  const title = `${categoryName} — He·Fa Productos`;
  const description = getCategoryDescription(categoryName);
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

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const categoryName = await resolveCategoryName(params.slug);
  const initialProducts = await fetchProductsByCategory(categoryName);

  const itemListLd = initialProducts.length > 0
    ? {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: categoryName,
        url: `${SITE_URL}/categoria/${params.slug}`,
        itemListElement: initialProducts.slice(0, 20).map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.name,
          url: `${SITE_URL}/producto/${p.slug}`,
        })),
      }
    : null;

  return (
    <>
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}
      <CategoryPageClient categoryName={categoryName} initialProducts={initialProducts} />
    </>
  );
}
