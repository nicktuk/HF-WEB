import { mayoristFetch } from '@/lib/comercio-fetch'
import { ComercioHeader } from '../_components/ComercioHeader'
import { Catalogo2Client } from './Catalogo2Client'
import { CatalogoPreview } from '../catalogo/CatalogoPreview'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

export const metadata = { robots: 'noindex, nofollow' }

export default async function Catalogo2Page() {
  const [catalogoRes, infoRes] = await Promise.all([
    mayoristFetch('/catalogo'),
    mayoristFetch('/info'),
  ])

  if (!catalogoRes.ok || !infoRes.ok) {
    const previewRes = await fetch(`${API}/public/comercios/catalogo`, { cache: 'no-store' })
    const data = previewRes.ok ? await previewRes.json() : { productos: [] }
    return <CatalogoPreview productos={data.productos} />
  }

  const { productos, config } = await catalogoRes.json()
  const info = await infoRes.json()

  return (
    <div className="min-h-screen">
      <ComercioHeader nombreLocal={info.nombre_local} />
      <Catalogo2Client
        productos={productos}
        montoMinimo={config.monto_minimo_pedido}
        modoPrecio={config.modo_precio}
        redondeo={config.redondeo}
        tramosDescuento={config.tramos_descuento}
      />
    </div>
  )
}
