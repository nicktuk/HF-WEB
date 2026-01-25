import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: process.env.NEXT_PUBLIC_SITE_NAME || 'HeFa - Productos',
    template: `%s | ${process.env.NEXT_PUBLIC_SITE_NAME || 'HeFa - Productos'}`,
  },
  description: process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'Catálogo de productos',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
