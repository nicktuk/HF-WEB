import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Portal Mayorista — HEFA',
  description: 'Accedé al canal mayorista de HEFA. Precios especiales para revendedores y comercios de bazar, hogar y electrodomésticos en zona sur GBA.',
}

export default function MayoristasLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
