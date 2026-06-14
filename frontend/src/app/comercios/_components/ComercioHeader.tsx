'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useComercioCart } from '@/hooks/useComercioCart'

interface Props {
  nombreLocal: string
}

export function ComercioHeader({ nombreLocal }: Props) {
  const router = useRouter()
  const itemCount = useComercioCart(s => s.itemCount())

  async function handleLogout() {
    await fetch('/api/comercios/auth/logout', { method: 'POST' })
    router.push('/comercios')
  }

  return (
    <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between gap-4">
      <span className="font-medium text-sm truncate">{nombreLocal}</span>

      <nav className="flex items-center gap-4 shrink-0">
        <Link href="/comercios/catalogo" className="text-sm text-gray-300 hover:text-white">
          Catálogo
        </Link>
        <Link href="/comercios/pedidos" className="text-sm text-gray-300 hover:text-white">
          Mis pedidos
        </Link>
        <Link
          href="/comercios/carrito"
          className="relative text-sm text-gray-300 hover:text-white"
        >
          Carrito
          {itemCount > 0 && (
            <span className="ml-1 bg-white text-gray-900 text-xs font-bold rounded-full px-1.5 py-0.5">
              {itemCount}
            </span>
          )}
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-white"
        >
          Salir
        </button>
      </nav>
    </header>
  )
}
