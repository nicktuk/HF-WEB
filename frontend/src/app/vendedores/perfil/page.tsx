'use client'

import { useEffect, useState } from 'react'
import { VendedorHeader } from '../_components/VendedorHeader'
import { LinkPersonal } from '../_components/LinkPersonal'

interface VendedorInfo {
  id: number
  nombre: string
  usuario: string
  email: string | null
  celular_wa: string
  link_personal: string
}

export default function MiPerfilPage() {
  const [info, setInfo] = useState<VendedorInfo | null>(null)

  useEffect(() => {
    fetch('/api/vendedores/info')
      .then(res => (res.ok ? res.json() : null))
      .then(setInfo)
  }, [])

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader nombre={info?.nombre} />
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800">Mi perfil</h1>
          <p className="text-sm text-zinc-500">Tus datos y tu link personal.</p>
        </div>

        {!info ? (
          <p className="text-sm text-zinc-400">Cargando...</p>
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-4 space-y-3">
              <div>
                <p className="text-xs text-zinc-500">Nombre</p>
                <p className="text-sm font-medium text-zinc-800">{info.nombre}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Usuario</p>
                <p className="text-sm font-medium text-zinc-800">{info.usuario}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">WhatsApp</p>
                <p className="text-sm font-medium text-zinc-800">{info.celular_wa}</p>
              </div>
              {info.email && (
                <div>
                  <p className="text-xs text-zinc-500">Email</p>
                  <p className="text-sm font-medium text-zinc-800">{info.email}</p>
                </div>
              )}
            </div>

            <LinkPersonal link={info.link_personal} />
          </>
        )}
      </div>
    </main>
  )
}
