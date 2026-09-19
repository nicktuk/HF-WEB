import Link from 'next/link'

/** Header liviano para visitantes sin sesión (preview del catálogo, sin precios/stock). */
export function PublicComercioHeader() {
  return (
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
  )
}
