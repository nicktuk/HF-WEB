'use client'

import Link from 'next/link'
import { ShoppingCart, LogOut, ClipboardList } from 'lucide-react'
import { useComercioCart } from '@/hooks/useComercioCart'

interface Props {
  nombreLocal: string
}

export function ComercioHeader({ nombreLocal }: Props) {
  const itemCount = useComercioCart(s => s.itemCount())

  async function handleLogout() {
    await fetch('/api/comercios/auth/logout', { method: 'POST' })
    // Navegación dura: limpia también el router cache del cliente, para que
    // /comercios/catalogo no quede mostrando una versión con sesión cacheada
    // (staleTimes.dynamic en next.config.js) después de cerrar sesión.
    window.location.href = '/comercios'
  }

  return (
    <header className="sticky top-0 z-40 header-texture shadow-lg px-4 py-3 flex items-center justify-between gap-4">
      <Link href="/comercios/catalogo" className="flex items-center gap-2.5 min-w-0">
        <span className="text-lg font-black tracking-[0.14em] text-white shrink-0">HE·FA</span>
        <span className="hidden sm:inline text-[10px] uppercase tracking-[0.2em] text-blue-200/70 font-medium shrink-0">
          Comercios
        </span>
        <span className="text-sm text-white/70 truncate border-l border-white/20 pl-2.5 ml-0.5">
          {nombreLocal}
        </span>
      </Link>

      <nav className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <Link
          href="/comercios/catalogo"
          className="text-sm font-medium text-white/80 hover:text-white px-2.5 py-1.5 rounded-full hover:bg-white/10 transition-colors hidden sm:inline-block"
        >
          Catálogo
        </Link>
        <Link
          href="/comercios/pedidos"
          className="text-sm font-medium text-white/80 hover:text-white px-2.5 py-1.5 rounded-full hover:bg-white/10 transition-colors hidden sm:inline-block"
        >
          Mis pedidos
        </Link>
        <Link
          href="/comercios/pedidos"
          className="flex sm:hidden items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all text-white/80"
          aria-label="Mis pedidos"
        >
          <ClipboardList className="h-4 w-4" />
        </Link>
        <Link
          href="/comercios/carrito"
          className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          aria-label="Ver carrito"
        >
          <ShoppingCart className="h-4 w-4 text-white" />
          {itemCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[10px] font-bold text-white leading-none">
              {itemCount}
            </span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center w-9 h-9 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-all text-white/70 hover:text-white"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </nav>
    </header>
  )
}
