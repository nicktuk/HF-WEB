import { redirect } from 'next/navigation'
import { mayoristFetch } from '@/lib/comercio-fetch'
import { ComercioHeader } from '../_components/ComercioHeader'
import { CatalogoClient } from './CatalogoClient'

export const metadata = { robots: 'noindex, nofollow' }

export default async function CatalogoPage() {
  const [catalogoRes, infoRes] = await Promise.all([
    mayoristFetch('/catalogo'),
    mayoristFetch('/info'),
  ])

  if (!catalogoRes.ok || !infoRes.ok) redirect('/comercios')

  const { productos, config } = await catalogoRes.json()
  const info = await infoRes.json()

  return (
    <div className="min-h-screen bg-gray-50">
      <ComercioHeader nombreLocal={info.nombre_local} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <CatalogoClient
          productos={productos}
          montoMinimo={config.monto_minimo_pedido}
        />
      </main>
    </div>
  )
}
