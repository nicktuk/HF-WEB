import { notFound } from 'next/navigation'
import { mayoristFetch } from '@/lib/comercio-fetch'
import { ComercioHeader } from '../../_components/ComercioHeader'
import { PublicComercioHeader } from '../../_components/PublicComercioHeader'
import { CapturarVendedorRef } from '../../_components/CapturarVendedorRef'
import { CatalogoClient } from './CatalogoClient'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export const metadata = { robots: 'noindex, nofollow' }

interface PublicProducto {
  id: number
  nombre: string
  marca: string | null
  categoria: string | null
  imagen_url: string | null
  cantidad_minima: number | null
}

export default async function CatalogoDetallePage({ params }: { params: { id: string } }) {
  const [productoRes, infoRes, catalogoRes] = await Promise.all([
    mayoristFetch(`/productos/${params.id}`),
    mayoristFetch('/info'),
    mayoristFetch('/catalogo'),
  ])

  if (productoRes.ok && infoRes.ok) {
    const producto = await productoRes.json()
    const info = await infoRes.json()

    let prevProductoId: number | null = null
    let nextProductoId: number | null = null
    if (catalogoRes.ok) {
      const { productos } = await catalogoRes.json() as { productos: { id: number }[] }
      const idx = productos.findIndex(x => x.id === producto.id)
      if (idx !== -1 && productos.length > 1) {
        prevProductoId = productos[(idx - 1 + productos.length) % productos.length].id
        nextProductoId = productos[(idx + 1) % productos.length].id
      }
    }

    return (
      <div className="min-h-screen">
        <CapturarVendedorRef />
        <ComercioHeader nombreLocal={info.nombre_local} />
        <CatalogoClient mode="full" producto={producto} prevProductoId={prevProductoId} nextProductoId={nextProductoId} />
      </div>
    )
  }

  if (productoRes.status === 404) notFound()

  // Sin sesión válida: mismo producto, en modo preview (sin precio/stock).
  const previewRes = await fetch(`${API}/public/comercios/catalogo`, { cache: 'no-store' })
  if (!previewRes.ok) notFound()

  const { productos } = await previewRes.json() as { productos: PublicProducto[] }
  const idNum = Number(params.id)
  const idx = productos.findIndex(p => p.id === idNum)
  if (idx === -1) notFound()

  const prevProductoId = productos.length > 1 ? productos[(idx - 1 + productos.length) % productos.length].id : null
  const nextProductoId = productos.length > 1 ? productos[(idx + 1) % productos.length].id : null

  return (
    <div className="min-h-screen">
      <CapturarVendedorRef />
      <PublicComercioHeader />
      <CatalogoClient mode="preview" producto={productos[idx]} prevProductoId={prevProductoId} nextProductoId={nextProductoId} />
    </div>
  )
}
