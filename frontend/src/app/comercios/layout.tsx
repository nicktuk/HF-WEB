import type { Metadata } from 'next'
import { ComercioBodyBg } from './_components/ComercioBodyBg'

export const metadata: Metadata = {
  title: 'Portal Comercio — HEFA',
  description: 'Accedé al canal comercio de HEFA. Precios especiales para revendedores y comercios de bazar, hogar y electrodomésticos en zona sur GBA.',
}

export default function ComerciosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ComercioBodyBg />
      {children}
    </>
  )
}
