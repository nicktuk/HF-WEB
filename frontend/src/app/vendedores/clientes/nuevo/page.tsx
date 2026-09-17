'use client'

import { VendedorHeader } from '../../_components/VendedorHeader'
import { ClienteForm, type ClienteFormData } from '../../_components/ClienteForm'

export default function NuevoClientePage() {
  async function handleSubmit(datos: ClienteFormData): Promise<string | null> {
    const res = await fetch('/api/vendedores/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })
    const data = await res.json() as { detail?: string; comercio_id?: number }
    if (!res.ok) return data.detail ?? 'No se pudo dar de alta al cliente.'

    window.location.href = '/vendedores/cartera'
    return null
  }

  return (
    <main className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      <VendedorHeader />
      <div className="max-w-md mx-auto px-4 py-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-zinc-800">Alta de cliente</h1>
          <p className="text-sm text-zinc-500">
            Cargalo ahora, con los datos que te dicta el comerciante. Queda pendiente hasta que HEFA lo apruebe.
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200/80 p-5">
          <ClienteForm submitLabel="Cargar alta" onSubmit={handleSubmit} />
        </div>
      </div>
    </main>
  )
}
