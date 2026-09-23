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

interface TramoComision {
  monto_desde: string
  porcentaje: string
}

interface ConfigApi {
  tramos: { monto_desde: number; porcentaje: number }[]
  oferta_porcentaje: number
  escalonada: boolean
}

const formatPesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`

export default function ComisionMinoristaPage() {
  const apiKey = useApiKey() ?? ''
  const [tramos, setTramos] = useState<TramoComision[]>([])
  const [oferta, setOferta] = useState('')
  const [escalonada, setEscalonada] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function cargar(d: ConfigApi) {
    setTramos(d.tramos.map(t => ({ monto_desde: String(t.monto_desde), porcentaje: String(t.porcentaje) })))
    setOferta(String(d.oferta_porcentaje))
    setEscalonada(d.escalonada)
  }

  useEffect(() => {
    if (!apiKey) return
    apiFetch('/admin/comision-minorista', apiKey).then(async res => {
      if (res.ok) cargar(await res.json())
      setLoading(false)
    })
  }, [apiKey])

  function updateTramo(index: number, field: keyof TramoComision, value: string) {
    setTramos(t => t.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  async function handleSave() {
    setError(null)
    const payload = tramos.map(t => ({
      monto_desde: parseFloat(t.monto_desde) || 0,
      porcentaje: parseFloat(t.porcentaje) || 0,
    }))
    if (!payload.some(t => t.monto_desde === 0)) {
      setError('La matriz tiene que tener un tramo desde $0.')
      return
    }
    setSaving(true)
    const res = await apiFetch('/admin/comision-minorista', apiKey, {
      method: 'PUT',
      body: JSON.stringify({
        tramos: payload,
        oferta_porcentaje: parseFloat(oferta) || 0,
        escalonada,
      }),
    })
    if (res.ok) {
      cargar(await res.json())
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2000)
    } else {
      const d = await res.json()
      setError(d.detail ?? 'Error al guardar')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comisión minorista</h1>
        <p className="text-sm text-gray-500 mt-0.5">Matriz semanal de comisión de los vendedores de ventas propias</p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Cargando...</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <p className="text-xs text-gray-500">
            Se calcula por semana (lunes a domingo) sobre lo que vendió cada vendedor, ofertas incluidas: ese total
            define el tramo. El % del tramo se aplica a la venta normal; lo vendido en oferta comisiona siempre al
            % de ofertas. Durante la semana se le muestra al vendedor como provisorio y queda cerrado el domingo.
            Al guardar se recalcula la semana en curso; las semanas anteriores no se tocan.
          </p>

          <div className="space-y-2">
            {tramos.map((t, i) => {
              const siguiente = tramos[i + 1]
              return (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-400 mb-0.5">
                      {parseFloat(t.monto_desde) === 0 ? 'Desde ($)' : 'Más de ($)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={t.monto_desde}
                      onChange={e => updateTramo(i, 'monto_desde', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-[11px] text-gray-400 mb-0.5">Comisión (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={t.porcentaje}
                      onChange={e => updateTramo(i, 'porcentaje', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                    />
                  </div>
                  <div className="hidden sm:block w-28 mt-4 text-[11px] text-gray-400">
                    {siguiente && siguiente.monto_desde !== ''
                      ? `hasta ${formatPesos(parseFloat(siguiente.monto_desde) || 0)}`
                      : 'sin tope'}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTramos(ts => ts.filter((_, j) => j !== i))}
                    className="mt-4 text-gray-300 hover:text-red-500 text-lg leading-none px-1"
                    aria-label="Quitar tramo"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            onClick={() => setTramos(t => [...t, { monto_desde: '', porcentaje: '' }])}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-dashed border-gray-300 rounded-lg py-2 w-full hover:border-gray-400 transition-colors"
          >
            + Agregar tramo
          </button>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={escalonada}
              onChange={e => setEscalonada(e.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Escalonado
              <span className="block text-xs text-gray-400">
                {escalonada
                  ? 'Cada tramo aplica sólo a la parte de la venta que cae dentro de él (ej: con 0 → 10% y más de $150.000 → 15%, vendiendo $200.000 cobra 10% de $150.000 + 15% de $50.000).'
                  : 'El tramo alcanzado aplica a toda la venta de la semana (ej: con 0 → 10% y más de $150.000 → 15%, vendiendo $200.000 cobra 15% de $200.000).'}
              </span>
            </span>
          </label>

          <div className="max-w-xs">
            <label className="block text-xs font-medium text-gray-700 mb-1">Productos en oferta (%)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={oferta}
              onChange={e => setOferta(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            />
            <p className="text-xs text-gray-400 mt-1">
              Para los items que estaban en oferta al cargarse la venta. Suman igual para alcanzar el tramo.
            </p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
              success
                ? 'bg-green-600 text-white'
                : 'bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50'
            }`}
          >
            {saving ? 'Guardando...' : success ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  )
}
