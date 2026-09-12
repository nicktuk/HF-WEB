import { redirect, notFound } from 'next/navigation'
import { mayoristFetch } from '@/lib/comercio-fetch'
import { ComercioHeader } from '../../_components/ComercioHeader'
import { ProductoDetailClient } from './ProductoDetailClient'

export const metadata = { robots: 'noindex, nofollow' }

export default async function ProductoDetailPage({ params }: { params: { id: string } }) {
  const [productoRes, infoRes] = await Promise.all([
    mayoristFetch(`/productos/${params.id}`),
    mayoristFetch('/info'),
  ])

  if (productoRes.status === 404) notFound()
  if (!productoRes.ok || !infoRes.ok) redirect('/comercios')

  const producto = await productoRes.json()
  const info = await infoRes.json()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0D1B2A' }}>
      <ComercioHeader nombreLocal={info.nombre_local} />
      <ProductoDetailClient producto={producto} />
    </div>
  )
}
