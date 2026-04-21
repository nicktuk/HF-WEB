import { MetadataRoute } from 'next';

const SERVER_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1';

const SITE_URL = 'https://www.hefaproductos.com.ar';

interface ProductSlugEntry {
  slug: string;
  updated_at?: string;
}

async function fetchAllProducts(): Promise<ProductSlugEntry[]> {
  const results: ProductSlugEntry[] = [];
  let page = 1;
  const limit = 200;
  while (true) {
    try {
      const res = await fetch(
        `${SERVER_API_URL}/public/products?page=${page}&limit=${limit}`,
        { next: { revalidate: 1800 } }
      );
      if (!res.ok) break;
      const data = await res.json();
      const items: ProductSlugEntry[] = data.items ?? data ?? [];
      if (!Array.isArray(items) || items.length === 0) break;
      results.push(...items.map((p) => ({ slug: p.slug, updated_at: p.updated_at })));
      if (items.length < limit) break;
      page++;
    } catch {
      break;
    }
  }
  return results;
}

async function fetchCategoryNames(): Promise<string[]> {
  try {
    const res = await fetch(`${SERVER_API_URL}/public/categories`, {
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const data: { name: string }[] = await res.json();
    return data.map((c) => c.name);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories] = await Promise.all([
    fetchAllProducts(),
    fetchCategoryNames(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/envios`,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((name) => ({
    url: `${SITE_URL}/categoria/${encodeURIComponent(name)}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = products.map((p) => ({
    url: `${SITE_URL}/producto/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
