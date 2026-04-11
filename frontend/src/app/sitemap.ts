import { MetadataRoute } from 'next';

const SERVER_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1';

const SITE_URL = 'https://www.hefaproductos.com.ar';

async function fetchAllProductSlugs(): Promise<string[]> {
  try {
    const slugs: string[] = [];
    let page = 1;
    const limit = 200;
    while (true) {
      const res = await fetch(
        `${SERVER_API_URL}/public/products?page=${page}&limit=${limit}`,
        { next: { revalidate: 3600 } }
      );
      if (!res.ok) break;
      const data = await res.json();
      const items: { slug: string }[] = data.items ?? data ?? [];
      if (!Array.isArray(items) || items.length === 0) break;
      slugs.push(...items.map((p) => p.slug));
      if (items.length < limit) break;
      page++;
    }
    return slugs;
  } catch {
    return [];
  }
}

async function fetchCategoryNames(): Promise<string[]> {
  try {
    const res = await fetch(`${SERVER_API_URL}/public/categories`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data: { name: string }[] = await res.json();
    return data.map((c) => c.name);
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [slugs, categories] = await Promise.all([
    fetchAllProductSlugs(),
    fetchCategoryNames(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories.map((name) => ({
    url: `${SITE_URL}/categoria/${encodeURIComponent(name)}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  const productRoutes: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${SITE_URL}/producto/${slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
