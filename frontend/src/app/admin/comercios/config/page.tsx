'use client'

import { useState, useEffect } from 'react'
import { useApiKey } from '@/hooks/useAuth'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1'

function apiFetch(path: string, apiKey: string, options?: RequestInit) {
  return fetch(`${API}${path}`, {
    ...options,
    headers: { 'X-Admin-API-Key': apiKey, 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  })
}

export default function ConfigComercioPage() {
  const apiKey = useApiKey() ?? ''
  const [tipoMarkup, setTipoMarkup] = useState<'fijo' | 'variable'>('fijo')
  const [descuento, setDescuento] = useState('')
  const [redondeo, setRedondeo] = useState('')
  const [montoMinimo, setMontoMinimo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) return
    apiFetch('/admin/comercios/config', apiKey).then(async res => {
      if (res.ok) {
        const d = await res.json()
        setTipoMarkup(d.tipo_markup ?? 'fijo')
        setDescuento(String(d.descuento_porcentaje))
        setRedondeo(String(d.redondeo))
        setMontoMinimo(String(d.monto_minimo_pedido))
      }
      setLoading(false)
    })
  }, [apiKey])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const res = await apiFetch('/admin/comercios/config', apiKey, {
      method: 'PATCH',
      body: JSON.stringify({
        tipo_markup: tipoMarkup,
        descuento_porcentaje: parseFloat(descuento),
        redondeo: parseInt(redondeo),
        monto_minimo_pedido: parseFloat(montoMinimo),
      }),
    })
    if (res.ok) {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } else {
      const d = await res.json()
      setError(d.detail ?? 'Error al guardar')
    }
    setSaving(false)
  }

  if (loading) return <p className="text-sm text-gray-400">Cargando...</p>

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración comercios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Parámetros globales del canal comercios</p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

        {/* Tipo de markup */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de markup</label>
          <div className="flex gap-3">
            {(['fijo', 'variable'] as const).map(tipo => (
              <button
                key={tipo}
                type="button"
                onClick={() => setTipoMarkup(tipo)}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm text-left transition-colors ${
                  tipoMarkup === tipo
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <p className="font-medium capitalize">{tipo}</p>
                <p className={`text-xs mt-0.5 ${tipoMarkup === tipo ? 'text-gray-300' : 'text-gray-400'}`}>
                  {tipo === 'fijo'
                    ? 'Margen fijo sobre precio de compra'
                    : 'Mitad del markup actual de cada producto'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Margen fijo — solo visible en modo fijo */}
        {tipoMarkup === 'fijo' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Margen sobre precio de compra (%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={descuento}
              onChange={e => setDescuento(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Ej: 30 → precio compra × 1,30. Se redondea según el valor de abajo.
            </p>
          </div>
        )}

        {tipoMarkup === 'variable' && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
            El precio de cada comercio se calcula como el promedio entre su precio de compra y su precio de venta actual,
            lo que equivale a dividir a la mitad el markup vigente del producto.
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Redondeo ($)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={redondeo}
            onChange={e => setRedondeo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Redondea al múltiplo superior. Ej: 100 → $1.234 queda en $1.300. Poner 0 para no redondear.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Monto mínimo de pedido ($)</label>
          <input
            type="number"
            step="1"
            min="0"
            value={montoMinimo}
            onChange={e => setMontoMinimo(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            required
          />
          <p className="text-xs text-gray-400 mt-1">
            Poner 0 para no tener mínimo.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving}
          className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
            success
              ? 'bg-green-600 text-white'
              : 'bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50'
          }`}
        >
          {saving ? 'Guardando...' : success ? 'Guardado' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  )
}
