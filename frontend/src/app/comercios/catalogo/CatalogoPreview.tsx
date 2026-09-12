import Image from 'next/image'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { resolveImageUrl } from '@/lib/api'

interface ProductoPreview {
  id: number
  nombre: string
  marca: string | null
  categoria: string | null
  imagen_url: string | null
  cantidad_minima: number | null
}

interface Props {
  productos: ProductoPreview[]
}

// Vista sin sesión: fotos y nombre, sin precio ni stock (eso requiere login).
export function CatalogoPreview({ productos }: Props) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <header className="header-texture text-white px-4 py-3 flex items-center justify-between gap-4">
        <span className="text-lg font-black tracking-[0.14em]">HE·FA</span>
        <nav className="flex items-center gap-2 shrink-0">
          <Link
            href="/comercios"
            className="text-sm font-medium text-white/80 hover:text-white px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/comercios/solicitud"
            className="text-sm bg-white text-zinc-900 rounded-full px-3.5 py-1.5 font-semibold hover:bg-zinc-100 transition-colors"
          >
            Solicitar acceso
          </Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-zinc-800">Catálogo Comercios</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Iniciá sesión con tu cuenta de comercio para ver precios y stock. ¿No tenés una?{' '}
            <Link href="/comercios/solicitud" className="font-medium text-primary-600 hover:underline">
              Solicitá acceso
            </Link>
            .
          </p>
        </div>

        {productos.length === 0 ? (
          <p className="text-zinc-500 text-sm">No hay productos disponibles por el momento.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {productos.map(p => {
              const imgUrl = resolveImageUrl(p.imagen_url)
              return (
                <div key={p.id} className="bg-white border border-zinc-200/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
                  <div className="aspect-square bg-zinc-50 relative">
                    {imgUrl ? (
                      <Image src={imgUrl} alt={p.nombre} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">Sin imagen</div>
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    {p.categoria && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 truncate">{p.categoria}</p>
                    )}
                    <p className="text-sm text-zinc-800 font-semibold leading-snug line-clamp-2">{p.nombre}</p>
                    {p.cantidad_minima && (
                      <p className="text-[11px] text-zinc-400">Mínimo: {p.cantidad_minima} u.</p>
                    )}
                    <div className="mt-auto pt-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                      <Lock className="h-3 w-3" />
                      Iniciá sesión para ver el precio
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
