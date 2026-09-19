import { redirect, notFound } from 'next/navigation'
import { mayoristFetch } from '@/lib/comercio-fetch'
import { ComercioHeader } from '../../_components/ComercioHeader'
import { Detalle2Client } from './Detalle2Client'

export const metadata = { robots: 'noindex, nofollow' }

export default async function Detalle2Page({ params }: { params: { id: string } }) {
  const [productoRes, infoRes] = await Promise.all([
    mayoristFetch(`/productos/${params.id}`),
    mayoristFetch('/info'),
  ])

  if (productoRes.status === 404) notFound()
  if (!productoRes.ok || !infoRes.ok) redirect('/comercios')

  const producto = await productoRes.json()
  const info = await infoRes.json()

  return (
    <div className="min-h-screen">
      <ComercioHeader nombreLocal={info.nombre_local} />
      <Detalle2Client producto={producto} />
    </div>
  )
}
