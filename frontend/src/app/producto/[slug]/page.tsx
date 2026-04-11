import type { Metadata } from 'next';
import ProductPageClient from '@/components/public/ProductPageClient';
import type { ProductPublic } from '@/types';

const SERVER_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1';

const SERVER_BASE = SERVER_API_URL.replace('/api/v1', '');
const SITE_URL = 'https://www.hefaproductos.com.ar';

function resolveOgImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return `${SERVER_BASE}${url}`;
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url.replace(/^https?:\/\/[^/]+(?=\/uploads\/)/, SERVER_BASE);
  }
  return url;
}

async function fetchProduct(slug: string): Promise<ProductPublic | null> {
  try {
    const res = await fetch(`${SERVER_API_URL}/public/products/${slug}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const product = await fetchProduct(params.slug);

  if (!product) {
    return {
      title: 'Producto no encontrado',
      description: 'He·Fa Productos — Productos para el hogar en Argentina.',
      alternates: {
        canonical: `${SITE_URL}/producto/${params.slug}`,
      },
    };
  }

  const description =
    product.short_description?.slice(0, 155) ||
    `${product.name} — Disponible en He·Fa Productos. Electrodomésticos, bazar, herramientas y más para el hogar en Argentina.`;

  const primaryImage = product.images?.find((img) => img.is_primary) || product.images?.[0];
  const ogImageUrl = resolveOgImageUrl(primaryImage?.url ?? null);

  return {
    title: product.name,
    description,
    alternates: {
      canonical: `${SITE_URL}/producto/${params.slug}`,
    },
    openGraph: {
      title: product.name,
      description,
      url: `${SITE_URL}/producto/${params.slug}`,
      siteName: 'He·Fa Productos',
      type: 'website',
      locale: 'es_AR',
      ...(ogImageUrl
        ? {
            images: [
              {
                url: ogImageUrl,
                width: 800,
                height: 800,
                alt: product.name,
              },
            ],
          }
        : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await fetchProduct(params.slug);

  const primaryImage = product?.images?.find((img) => img.is_primary) || product?.images?.[0];
  const ogImageUrl = resolveOgImageUrl(primaryImage?.url ?? null);

  const jsonLd = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.short_description || product.name,
        url: `${SITE_URL}/producto/${params.slug}`,
        brand: product.brand
          ? { '@type': 'Brand', name: product.brand }
          : undefined,
        category: product.category || undefined,
        ...(ogImageUrl ? { image: ogImageUrl } : {}),
        offers: {
          '@type': 'Offer',
          priceCurrency: product.currency || 'ARS',
          price: product.price ?? undefined,
          availability:
            (product.stock_qty ?? 1) > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
          seller: {
            '@type': 'Organization',
            name: 'He·Fa Productos',
          },
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ProductPageClient initialData={product ?? undefined} />
    </>
  );
}
