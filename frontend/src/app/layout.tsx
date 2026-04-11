import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import MetaPixel from './components/MetaPixel';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'He·Fa Productos | Productos para el hogar en Argentina',
    template: '%s | He·Fa Productos',
  },
  description: 'He·Fa Productos: electrodomésticos, bazar, herramientas y más para el hogar en Argentina. Distribución mayorista y minorista.',
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
              '@type': 'Organization',
              name: 'He·Fa Productos',
              url: 'https://www.hefaproductos.com.ar',
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
        <MetaPixel />
      </body>
    </html>
  );
}
