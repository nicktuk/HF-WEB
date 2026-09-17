'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'

const LINKS = [
  { href: '/vendedores/inicio', label: 'Mi día' },
  { href: '/vendedores/cartera', label: 'Mi cartera' },
  { href: '/vendedores/catalogo', label: 'Catálogo' },
  { href: '/vendedores/ventas', label: 'Mis ventas' },
  { href: '/vendedores/plata', label: 'Mi plata' },
  { href: '/vendedores/prospectos', label: 'Prospectos' },
  { href: '/vendedores/perfil', label: 'Mi perfil' },
]

interface Props {
  nombre?: string
}

export function VendedorHeader({ nombre }: Props) {
  const pathname = usePathname()

  async function handleLogout() {
    await fetch('/api/vendedores/auth/logout', { method: 'POST' })
    window.location.href = '/vendedores'
  }

  return (
    <header className="sticky top-0 z-40 header-texture shadow-lg">
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/vendedores/inicio" className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg font-black tracking-[0.14em] text-white shrink-0">HE·FA</span>
          {nombre && (
            <span className="text-sm text-white/70 truncate border-l border-white/20 pl-2.5 ml-0.5">
              {nombre}
            </span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all text-white/70 hover:text-white shrink-0"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
      <nav className="flex items-center gap-1 px-2 pb-2 overflow-x-auto">
        {LINKS.map(link => {
          const activo = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium px-3 py-1.5 rounded-full whitespace-nowrap transition-colors ${
                activo ? 'bg-white text-zinc-800' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
