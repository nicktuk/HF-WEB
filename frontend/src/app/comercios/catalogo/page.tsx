import { redirect } from 'next/navigation'
import { mayoristFetch } from '@/lib/comercio-fetch'
import { CapturarVendedorRef } from '../_components/CapturarVendedorRef'
import { PublicComercioHeader } from '../_components/PublicComercioHeader'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export const metadata = { robots: 'noindex, nofollow' }

/**
 * El catálogo ya no es una grilla: es el primer producto en
 * /comercios/catalogo/[id], desde donde se navega de producto en producto
 * con las flechas. Esta página solo redirige ahí (con o sin sesión).
 */
export default async function CatalogoIndexPage() {
  const catalogoRes = await mayoristFetch('/catalogo')
  if (catalogoRes.ok) {
    const { productos } = await catalogoRes.json() as { productos: { id: number }[] }
    if (productos.length > 0) redirect(`/comercios/catalogo/${productos[0].id}`)
  } else {
    const previewRes = await fetch(`${API}/public/comercios/catalogo`, { cache: 'no-store' })
    if (previewRes.ok) {
      const { productos } = await previewRes.json() as { productos: { id: number }[] }
      if (productos.length > 0) redirect(`/comercios/catalogo/${productos[0].id}`)
    }
  }

  return (
    <div className="min-h-screen">
      <CapturarVendedorRef />
      <PublicComercioHeader />
      <p className="text-center text-sm text-zinc-500 py-16">Todavía no hay productos cargados.</p>
    </div>
  )
}
