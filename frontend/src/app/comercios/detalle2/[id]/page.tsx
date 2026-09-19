import { redirect, notFound } from 'next/navigation'
import { mayoristFetch } from '@/lib/comercio-fetch'
import { ComercioHeader } from '../../_components/ComercioHeader'
import { Detalle2Client } from './Detalle2Client'

export const metadata = { robots: 'noindex, nofollow' }

export default async function Detalle2Page({ params }: { params: { id: string } }) {
  const [productoRes, infoRes, catalogoRes] = await Promise.all([
    mayoristFetch(`/productos/${params.id}`),
    mayoristFetch('/info'),
    mayoristFetch('/catalogo'),
  ])

  if (productoRes.status === 404) notFound()
  if (!productoRes.ok || !infoRes.ok) redirect('/comercios')

  const producto = await productoRes.json()
  const info = await infoRes.json()

  let prevProductoId: number | null = null
  let nextProductoId: number | null = null
  if (catalogoRes.ok) {
    const { productos } = await catalogoRes.json() as { productos: { id: number }[] }
    const idx = productos.findIndex(p => p.id === producto.id)
    if (idx !== -1 && productos.length > 1) {
      prevProductoId = productos[(idx - 1 + productos.length) % productos.length].id
      nextProductoId = productos[(idx + 1) % productos.length].id
    }
  }

  return (
    <div className="min-h-screen">
      <ComercioHeader nombreLocal={info.nombre_local} />
      <Detalle2Client producto={producto} prevProductoId={prevProductoId} nextProductoId={nextProductoId} />
    </div>
  )
}
