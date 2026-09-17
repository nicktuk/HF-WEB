'use client'

import { useState } from 'react'

interface Props {
  link: string
}

export function LinkPersonal({ link }: Props) {
  const [copiado, setCopiado] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de clipboard: el usuario igual puede seleccionar el texto del input.
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Tu link personal</p>
      <p className="text-sm text-zinc-500 mb-3">
        Compartilo por WhatsApp o imprimilo como QR. Todo el que entre por acá y pida el alta queda en tu cartera.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          readOnly
          value={link}
          onFocus={e => e.target.select()}
          className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
        <button
          onClick={copiar}
          className="px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors shrink-0"
        >
          {copiado ? 'Copiado ✓' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
