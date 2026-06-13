'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMayoristaCart } from '@/hooks/useMayoristaCart'

interface Props {
  nombreLocal: string
}

export function MayoristaHeader({ nombreLocal }: Props) {
  const router = useRouter()
  const itemCount = useMayoristaCart(s => s.itemCount())

  async function handleLogout() {
    await fetch('/api/mayoristas/auth/logout', { method: 'POST' })
    router.push('/mayoristas')
  }

  return (
    <header className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between gap-4">
      <span className="font-medium text-sm truncate">{nombreLocal}</span>

      <nav className="flex items-center gap-4 shrink-0">
        <Link href="/mayoristas/catalogo" className="text-sm text-gray-300 hover:text-white">
          Catálogo
        </Link>
        <Link href="/mayoristas/pedidos" className="text-sm text-gray-300 hover:text-white">
          Mis pedidos
        </Link>
        <Link
          href="/mayoristas/carrito"
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
