import { mayoristFetch } from '@/lib/comercio-fetch'
import { ComercioHeader } from '../_components/ComercioHeader'
import { CatalogoClient } from './CatalogoClient'
import { CatalogoPreview } from './CatalogoPreview'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export const metadata = { robots: 'noindex, nofollow' }

export default async function CatalogoPage() {
  const [catalogoRes, infoRes] = await Promise.all([
    mayoristFetch('/catalogo'),
    mayoristFetch('/info'),
  ])

  // Sin sesión válida (o token expirado): preview sin precios ni stock,
  // en vez de redirigir — el catálogo ahora es de acceso público.
  if (!catalogoRes.ok || !infoRes.ok) {
    const previewRes = await fetch(`${API}/public/comercios/catalogo`, { cache: 'no-store' })
    const data = previewRes.ok ? await previewRes.json() : { productos: [] }
    return <CatalogoPreview productos={data.productos} />
  }

  const { productos, config } = await catalogoRes.json()
  const info = await infoRes.json()

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <ComercioHeader nombreLocal={info.nombre_local} />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <CatalogoClient
          productos={productos}
          montoMinimo={config.monto_minimo_pedido}
          modoPrecio={config.modo_precio}
          redondeo={config.redondeo}
          tramosDescuento={config.tramos_descuento}
        />
      </main>
    </div>
  )
}
