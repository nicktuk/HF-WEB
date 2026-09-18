'use client'

import { useState } from 'react'
import { VendedorHeader } from '../../_components/VendedorHeader'
import { ClienteForm, type ClienteFormData, type ClienteFormResult } from '../../_components/ClienteForm'

export default function NuevoClientePage() {
  const [otp, setOtp] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  async function handleSubmit(datos: ClienteFormData): Promise<ClienteFormResult> {
    const res = await fetch('/api/vendedores/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    const data = await res.json() as { detail?: string; otp?: string }
    if (!res.ok || !data.otp) return { ok: false, error: data.detail ?? 'No se pudo dar de alta al cliente.' }
    return { ok: true, otp: data.otp }
  }

  async function copiar() {
    if (!otp) return
    try {
      await navigator.clipboard.writeText(otp)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Sin permiso de clipboard: el usuario igual puede seleccionar el texto del input.
    }
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader />
      <div className="max-w-md mx-auto px-4 py-6">
        {otp ? (
          <div className="bg-white rounded-2xl vendedor-card p-5 space-y-3">
            <h1 className="text-lg font-semibold text-zinc-800">Cliente cargado ✓</h1>
            <p className="text-sm text-zinc-500">
              Pasale esta contraseña temporal por WhatsApp — no se vuelve a mostrar. Queda pendiente hasta que HEFA lo apruebe.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={otp}
                onFocus={e => e.target.select()}
                className="flex-1 border border-zinc-300 rounded-lg px-3 py-2 text-sm font-mono tracking-wider text-center"
              />
              <button
                onClick={copiar}
                className="px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
              >
                {copiado ? 'Copiado ✓' : 'Copiar'}
              </button>
            </div>
            <a
              href="/vendedores/cartera"
              className="block text-center w-full bg-zinc-100 text-zinc-700 rounded-lg py-2.5 text-sm font-semibold hover:bg-zinc-200 transition-colors"
            >
              Ir a mi cartera
            </a>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h1 className="text-xl font-semibold text-zinc-800">Alta de cliente</h1>
              <p className="text-sm text-zinc-500">
                Cargalo ahora, con los datos que te dicta el comerciante. Queda pendiente hasta que HEFA lo apruebe.
              </p>
            </div>
            <div className="bg-white rounded-2xl vendedor-card p-5">
              <ClienteForm submitLabel="Cargar alta" onSubmit={handleSubmit} onSuccess={setOtp} />
            </div>
          </>
        )}
      </div>
    </main>
  )
}
