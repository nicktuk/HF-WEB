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

interface Tramo {
  id?: number
  cantidad_minima: string
  descuento_porcentaje: string
}

interface TramoComision {
  monto_desde: string
  porcentaje: string
}

type TramoComisionApi = { id: number; monto_desde: number; porcentaje: number }

function tramosComisionFromApi(d: TramoComisionApi[]): TramoComision[] {
  return d.map(t => ({ monto_desde: String(t.monto_desde), porcentaje: String(t.porcentaje) }))
}

const formatPesos = (n: number) => `$${n.toLocaleString('es-AR', { maximumFractionDigits: 2 })}`

export default function ConfigComercioPage() {
  const apiKey = useApiKey() ?? ''
  const [modoPrecio, setModoPrecio] = useState<'markup' | 'descuento'>('markup')
  const [tipoMarkup, setTipoMarkup] = useState<'fijo' | 'variable'>('fijo')
  const [mostrarTodos, setMostrarTodos] = useState(false)
  const [descuento, setDescuento] = useState('')
  const [redondeo, setRedondeo] = useState('')
  const [montoMinimo, setMontoMinimo] = useState('')
  const [comisionMayoristaNuevo, setComisionMayoristaNuevo] = useState('')
  const [comisionMayoristaRecompra, setComisionMayoristaRecompra] = useState('')
  const [semaforoDiasAmarillo, setSemaforoDiasAmarillo] = useState('')
  const [semaforoDiasRojo, setSemaforoDiasRojo] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tramos, setTramos] = useState<Tramo[]>([])
  const [savingTramos, setSavingTramos] = useState(false)
  const [tramosSuccess, setTramosSuccess] = useState(false)
  const [tramosError, setTramosError] = useState<string | null>(null)

  const [tramosComision, setTramosComision] = useState<TramoComision[]>([])
  const [comisionOferta, setComisionOferta] = useState('')
  const [comisionEscalonada, setComisionEscalonada] = useState(false)
  const [savingComision, setSavingComision] = useState(false)
  const [comisionSuccess, setComisionSuccess] = useState(false)
  const [comisionError, setComisionError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiKey) return
    apiFetch('/admin/comercios/config', apiKey).then(async res => {
      if (res.ok) {
        const d = await res.json()
        setModoPrecio(d.modo_precio ?? 'markup')
        setTipoMarkup(d.tipo_markup ?? 'fijo')
        setMostrarTodos(!!d.mostrar_todos_con_stock)
        setDescuento(String(d.descuento_porcentaje))
        setRedondeo(String(d.redondeo))
        setMontoMinimo(String(d.monto_minimo_pedido))
        setComisionMayoristaNuevo(String(d.comision_mayorista_nuevo_porcentaje))
        setComisionMayoristaRecompra(String(d.comision_mayorista_recompra_porcentaje))
        setComisionOferta(String(d.comision_minorista_oferta_porcentaje))
        setComisionEscalonada(!!d.comision_minorista_escalonada)
        setSemaforoDiasAmarillo(String(d.semaforo_dias_amarillo))
        setSemaforoDiasRojo(String(d.semaforo_dias_rojo))
      }
      setLoading(false)
    })
    apiFetch('/admin/comercios/config/tramos', apiKey).then(async res => {
      if (res.ok) {
        const d = await res.json() as { id: number; cantidad_minima: number; descuento_porcentaje: number }[]
        setTramos(d.map(t => ({ id: t.id, cantidad_minima: String(t.cantidad_minima), descuento_porcentaje: String(t.descuento_porcentaje) })))
      }
    })
    apiFetch('/admin/comercios/config/comision-minorista-tramos', apiKey).then(async res => {
      if (res.ok) setTramosComision(tramosComisionFromApi(await res.json()))
    })
  }, [apiKey])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (parseInt(semaforoDiasRojo) <= parseInt(semaforoDiasAmarillo)) {
      setError('Los días de rojo deben ser mayores que los de amarillo.')
      return
    }
    setSaving(true)
    const res = await apiFetch('/admin/comercios/config', apiKey, {
      method: 'PATCH',
      body: JSON.stringify({
        modo_precio: modoPrecio,
        tipo_markup: tipoMarkup,
        mostrar_todos_con_stock: mostrarTodos,
        descuento_porcentaje: parseFloat(descuento),
        redondeo: parseInt(redondeo),
        monto_minimo_pedido: parseFloat(montoMinimo),
        comision_mayorista_nuevo_porcentaje: parseFloat(comisionMayoristaNuevo),
        comision_mayorista_recompra_porcentaje: parseFloat(comisionMayoristaRecompra),
        semaforo_dias_amarillo: parseInt(semaforoDiasAmarillo),
        semaforo_dias_rojo: parseInt(semaforoDiasRojo),
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

  function addTramo() {
    setTramos(t => [...t, { cantidad_minima: '', descuento_porcentaje: '' }])
  }

  function removeTramo(index: number) {
    setTramos(t => t.filter((_, i) => i !== index))
  }

  function updateTramo(index: number, field: keyof Tramo, value: string) {
    setTramos(t => t.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  function updateTramoComision(index: number, field: keyof TramoComision, value: string) {
    setTramosComision(t => t.map((row, i) => i === index ? { ...row, [field]: value } : row))
  }

  async function handleSaveComisionMinorista() {
    setComisionError(null)
    const payload = tramosComision.map(t => ({
      monto_desde: parseFloat(t.monto_desde) || 0,
      porcentaje: parseFloat(t.porcentaje) || 0,
    }))
    if (!payload.some(t => t.monto_desde === 0)) {
      setComisionError('La matriz tiene que tener un tramo desde $0.')
      return
    }
    setSavingComision(true)
    const [cfgRes, tramosRes] = await Promise.all([
      apiFetch('/admin/comercios/config', apiKey, {
        method: 'PATCH',
        body: JSON.stringify({
          comision_minorista_oferta_porcentaje: parseFloat(comisionOferta) || 0,
          comision_minorista_escalonada: comisionEscalonada,
        }),
      }),
      apiFetch('/admin/comercios/config/comision-minorista-tramos', apiKey, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    ])
    if (cfgRes.ok && tramosRes.ok) {
      setTramosComision(tramosComisionFromApi(await tramosRes.json()))
      setComisionSuccess(true)
      setTimeout(() => setComisionSuccess(false), 2000)
    } else {
      const d = await (cfgRes.ok ? tramosRes : cfgRes).json()
      setComisionError(d.detail ?? 'Error al guardar')
    }
    setSavingComision(false)
  }

  async function handleSaveTramos() {
    setTramosError(null)
    setSavingTramos(true)
    const payload = tramos.map(t => ({
      cantidad_minima: parseInt(t.cantidad_minima) || 0,
      descuento_porcentaje: parseFloat(t.descuento_porcentaje) || 0,
    }))
    const res = await apiFetch('/admin/comercios/config/tramos', apiKey, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      const d = await res.json() as { id: number; cantidad_minima: number; descuento_porcentaje: number }[]
      setTramos(d.map(t => ({ id: t.id, cantidad_minima: String(t.cantidad_minima), descuento_porcentaje: String(t.descuento_porcentaje) })))
      setTramosSuccess(true)
      setTimeout(() => setTramosSuccess(false), 2000)
    } else {
      const d = await res.json()
      setTramosError(d.detail ?? 'Error al guardar la matriz')
    }
    setSavingTramos(false)
  }

  if (loading) return <p className="text-sm text-gray-400">Cargando...</p>

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Configuración comercios</h1>
        <p className="text-sm text-gray-500 mt-0.5">Parámetros globales del canal comercios</p>
      </div>

      <form onSubmit={handleSave} className="bg-white border border-gray-200 rounded-xl p-6 space-y-5">

        {/* Catálogo extendido */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Mostrar todos los productos con stock</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Incluye en el catálogo todos los productos habilitados con stock &gt; 0 y markup &gt; 50%, además de los marcados como comercio.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarTodos(v => !v)}
            className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${mostrarTodos ? 'bg-gray-900' : 'bg-gray-200'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${mostrarTodos ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Modo de precio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Modo de precio</label>
          <div className="flex gap-3">
            {(['markup', 'descuento'] as const).map(modo => (
              <button
                key={modo}
                type="button"
                onClick={() => setModoPrecio(modo)}
                className={`flex-1 rounded-lg border px-4 py-3 text-sm text-left transition-colors ${
                  modoPrecio === modo
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <p className="font-medium capitalize">{modo === 'markup' ? 'Por markup' : 'Por descuento'}</p>
                <p className={`text-xs mt-0.5 ${modoPrecio === modo ? 'text-gray-300' : 'text-gray-400'}`}>
                  {modo === 'markup'
                    ? 'Margen sobre el precio de compra'
                    : 'Descuento sobre el precio minorista, según cantidad'}
                </p>
              </button>
            ))}
          </div>
        </div>

        {modoPrecio === 'markup' && (
          <>
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
          </>
        )}

        {modoPrecio === 'descuento' && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-700">
            El precio de cada comercio parte del precio minorista y descuenta el % que corresponda según la cantidad pedida.
            Configurá la matriz de tramos más abajo.
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

        <div className="border-t border-gray-100 pt-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Comisión mayorista (default general)</h2>
          <p className="text-xs text-gray-500 mb-3">
            % sobre el monto pagado que se atribuye al vendedor de la cartera. Se usa para los vendedores que
            no tienen su propio % cargado (en /admin/vendedores, editando cada uno). Se aplica desde el momento
            en que se guarda — no afecta comisiones ya generadas (esas se editan una por una en /admin/comisiones).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mayorista, cliente nuevo (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={comisionMayoristaNuevo}
                onChange={e => setComisionMayoristaNuevo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Mayorista, recompra (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={comisionMayoristaRecompra}
                onChange={e => setComisionMayoristaRecompra(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                required
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Semáforo de recompra</h2>
          <p className="text-xs text-gray-500 mb-3">
            Días sin pedir desde el último pedido para pasar de verde a amarillo, y de amarillo a rojo.
            Se ve en Mi cartera y Mi día del portal de vendedores.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Días para amarillo</label>
              <input
                type="number"
                step="1"
                min="1"
                value={semaforoDiasAmarillo}
                onChange={e => setSemaforoDiasAmarillo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Días para rojo</label>
              <input
                type="number"
                step="1"
                min="1"
                value={semaforoDiasRojo}
                onChange={e => setSemaforoDiasRojo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                required
              />
            </div>
          </div>
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

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Comisión minorista (semanal)</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Se calcula por semana (lunes a domingo) sobre lo que vendió cada vendedor, ofertas incluidas: ese total
            define el tramo. El % del tramo se aplica a la venta normal; lo vendido en oferta comisiona siempre al
            % de ofertas. Durante la semana se le muestra al vendedor como provisorio y queda cerrado el domingo.
            Al guardar se recalcula la semana en curso; las semanas anteriores no se tocan.
          </p>
        </div>

        <div className="space-y-2">
          {tramosComision.map((t, i) => {
            const siguiente = tramosComision[i + 1]
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
                    onChange={e => updateTramoComision(i, 'monto_desde', e.target.value)}
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
                    onChange={e => updateTramoComision(i, 'porcentaje', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div className="hidden sm:block w-40 mt-4 text-[11px] text-gray-400">
                  {siguiente && siguiente.monto_desde !== ''
                    ? `hasta ${formatPesos(parseFloat(siguiente.monto_desde) || 0)}`
                    : 'sin tope'}
                </div>
                <button
                  type="button"
                  onClick={() => setTramosComision(ts => ts.filter((_, j) => j !== i))}
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
          onClick={() => setTramosComision(t => [...t, { monto_desde: '', porcentaje: '' }])}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-dashed border-gray-300 rounded-lg py-2 w-full hover:border-gray-400 transition-colors"
        >
          + Agregar tramo
        </button>

        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={comisionEscalonada}
            onChange={e => setComisionEscalonada(e.target.checked)}
            className="mt-0.5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">
            Escalonado
            <span className="block text-xs text-gray-400">
              {comisionEscalonada
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
            value={comisionOferta}
            onChange={e => setComisionOferta(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <p className="text-xs text-gray-400 mt-1">
            Para los items que estaban en oferta al cargarse la venta. Suman igual para alcanzar el tramo.
          </p>
        </div>

        {comisionError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{comisionError}</p>
        )}

        <button
          type="button"
          onClick={handleSaveComisionMinorista}
          disabled={savingComision}
          className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
            comisionSuccess
              ? 'bg-green-600 text-white'
              : 'bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50'
          }`}
        >
          {savingComision ? 'Guardando...' : comisionSuccess ? 'Guardado' : 'Guardar comisión minorista'}
        </button>
      </div>

      {modoPrecio === 'descuento' && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Matriz cantidad / descuento</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              A partir de cuántas unidades de un mismo producto se aplica cada % de descuento sobre el precio minorista.
            </p>
          </div>

          <div className="space-y-2">
            {tramos.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] text-gray-400 mb-0.5">Desde (unidades)</label>
                  <input
                    type="number"
                    min="1"
                    value={t.cantidad_minima}
                    onChange={e => updateTramo(i, 'cantidad_minima', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[11px] text-gray-400 mb-0.5">Descuento (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={t.descuento_porcentaje}
                    onChange={e => updateTramo(i, 'descuento_porcentaje', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeTramo(i)}
                  className="mt-4 text-gray-300 hover:text-red-500 text-lg leading-none px-1"
                  aria-label="Quitar tramo"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addTramo}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 border border-dashed border-gray-300 rounded-lg py-2 w-full hover:border-gray-400 transition-colors"
          >
            + Agregar tramo
          </button>

          {tramosError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{tramosError}</p>
          )}

          <button
            type="button"
            onClick={handleSaveTramos}
            disabled={savingTramos}
            className={`w-full rounded-lg py-2.5 text-sm font-medium transition-colors ${
              tramosSuccess
                ? 'bg-green-600 text-white'
                : 'bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50'
            }`}
          >
            {savingTramos ? 'Guardando...' : tramosSuccess ? 'Guardado' : 'Guardar matriz'}
          </button>
        </div>
      )}
    </div>
  )
}
