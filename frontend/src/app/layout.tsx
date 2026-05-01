import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import TrackingScripts from './components/TrackingScripts';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'He·Fa Productos | Productos para el hogar en Argentina',
    template: '%s | He·Fa Productos',
  },
  description: 'He·Fa Productos: electrodomésticos, bazar, herramientas y más para el hogar en Argentina. Distribución mayorista y minorista.',
  twitter: {
    card: 'summary_large_image',
    site: '@hefaproductos',
  },
  other: {
    'facebook-domain-verification': '53w6gpprzxqdjlc23ungr77mi88duv',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'LocalBusiness',
              name: 'He·Fa Productos',
              url: 'https://www.hefaproductos.com.ar',
              telephone: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER
                ? `+${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`
                : undefined,
              priceRange: '$$',
              address: {
                '@type': 'PostalAddress',
                addressRegion: 'Buenos Aires',
                addressCountry: 'AR',
              },
              areaServed: [
                { '@type': 'City', name: 'Ezeiza' },
                { '@type': 'City', name: 'Canning' },
                { '@type': 'City', name: 'Monte Grande' },
                { '@type': 'City', name: 'Tristán Suárez' },
                { '@type': 'City', name: 'Guernica' },
                { '@type': 'City', name: 'Lomas de Zamora' },
                { '@type': 'AdministrativeArea', name: 'GBA Sur' },
              ],
              sameAs: ['https://www.instagram.com/hefa.productos'],
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'WebSite',
              name: 'He·Fa Productos',
              url: 'https://www.hefaproductos.com.ar',
              potentialAction: {
                '@type': 'SearchAction',
                target: {
                  '@type': 'EntryPoint',
                  urlTemplate:
                    'https://www.hefaproductos.com.ar/?search={search_term_string}',
                },
                'query-input': 'required name=search_term_string',
              },
            }),
          }}
        />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <TrackingScripts />
      </body>
    </html>
  );
}
