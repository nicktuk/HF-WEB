'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, ShoppingCart, RefreshCw, Zap, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useApiKey } from '@/hooks/useAuth';
import { importScorerApi } from '@/lib/api';
import type { ISCarrito, ISCarritoCreate, ISProducto } from '@/types';

const ESTADO_COLORS: Record<string, string> = {
  borrador:    'bg-gray-100 text-gray-600',
  cotizado:    'bg-blue-100 text-blue-700',
  comprado:    'bg-purple-100 text-purple-700',
  en_transito: 'bg-orange-100 text-orange-700',
  recibido:    'bg-green-100 text-green-700',
  cancelado:   'bg-red-100 text-red-700',
};

const SEMAFORO_COLORS: Record<string, string> = {
  verde: 'text-green-600', amarillo: 'text-yellow-600', rojo: 'text-red-600',
};

const TRANSICIONES: Record<string, string[]> = {
  borrador:    ['cotizado', 'cancelado'],
  cotizado:    ['comprado', 'borrador', 'cancelado'],
  comprado:    ['en_transito', 'cancelado'],
  en_transito: ['recibido'],
  recibido:    [],
  cancelado:   ['borrador'],
};

function ResumenPanel({ resumen, alertas }: { resumen: Record<string, unknown> | null; alertas: Array<Record<string, unknown>> }) {
  if (!resumen) return <div className="text-sm text-gray-400 py-4 text-center">Cotizá para ver el resumen</div>;

  const semaforo = resumen.semaforo_envio as string;
  const ratio = resumen.ratio_envio as number | null;
  const peso = resumen.peso_total_kg as number;
  const costo = resumen.costo_total_usd as number;

  return (
    <div className="space-y-3">
      <div className={`rounded-xl p-4 text-center ${semaforo === 'verde' ? 'bg-green-50' : semaforo === 'amarillo' ? 'bg-yellow-50' : 'bg-red-50'}`}>
        <div className={`text-3xl font-bold ${SEMAFORO_COLORS[semaforo] ?? 'text-gray-600'}`}>
          {ratio != null ? `${ratio.toFixed(2)}×` : '—'}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">ratio de margen</div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {[
          ['Peso total', `${peso.toFixed(1)} kg`],
          ['Costo USD', `$${costo.toFixed(2)}`],
          ['Subtotal prods', `$${(resumen.subtotal_productos_usd as number).toFixed(2)}`],
          ['Tax', `$${(resumen.sales_tax_usd as number).toFixed(2)}`],
          ['Flete', `$${(resumen.costo_flete_usd as number).toFixed(2)}`],
          ['Costo ARS', `$${((resumen.costo_total_ars as number) ?? 0).toLocaleString('es-AR')}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-gray-50 rounded-lg p-2">
            <div className="text-gray-400">{label}</div>
            <div className="font-medium text-gray-700">{value}</div>
          </div>
        ))}
      </div>

      {alertas.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-gray-500">Alertas</div>
          {alertas.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${a.tipo === 'rojo' ? 'bg-red-50 text-red-700' : a.tipo === 'warning' ? 'bg-orange-50 text-orange-700' : 'bg-yellow-50 text-yellow-700'}`}>
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{a.mensaje as string}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CarritosPage() {
  const apiKey = useApiKey() || '';
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newNombre, setNewNombre] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const { data: carritos = [], isLoading } = useQuery({
    queryKey: ['is-carritos'],
    queryFn: () => importScorerApi.getCarritos(apiKey),
    enabled: !!apiKey,
  });

  const { data: productos = [] } = useQuery({
    queryKey: ['is-productos-activos'],
    queryFn: () => importScorerApi.getProductos(apiKey, { semaforo: undefined, limit: 200 }),
    enabled: !!apiKey && showAddProduct,
  });

  const carrito = (carritos as ISCarrito[]).find((c) => c.id === selected);

  const createMutation = useMutation({
    mutationFn: (d: ISCarritoCreate) => importScorerApi.createCarrito(apiKey, d),
    onSuccess: (c) => { qc.invalidateQueries({ queryKey: ['is-carritos'] }); setSelected(c.id); setShowNew(false); setNewNombre(''); showToast('Carrito creado'); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.deleteCarrito(apiKey, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-carritos'] }); setSelected(null); showToast('Carrito eliminado'); },
  });
  const cotizarMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.cotizarCarrito(apiKey, id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-carritos'] }); showToast('Carrito cotizado'); },
  });
  const estadoMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: string }) => importScorerApi.cambiarEstadoCarrito(apiKey, id, estado),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-carritos'] }); showToast('Estado actualizado'); },
  });
  const removeItemMutation = useMutation({
    mutationFn: ({ carritoId, itemId }: { carritoId: string; itemId: string }) => importScorerApi.removeItemCarrito(apiKey, carritoId, itemId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['is-carritos'] }),
  });
  const addItemMutation = useMutation({
    mutationFn: ({ carritoId, productoId, precio, peso }: { carritoId: string; productoId: string; precio: number; peso: number }) =>
      importScorerApi.addItemCarrito(apiKey, carritoId, {
        producto_id: productoId, precio_usd_locked: precio, peso_kg_locked: peso, cantidad: 1,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['is-carritos'] }); setShowAddProduct(false); showToast('Producto agregado'); },
  });
  const listaCazaMutation = useMutation({
    mutationFn: (id: string) => importScorerApi.generarListaCaza(apiKey, id),
    onSuccess: (res) => { showToast(`Lista de caza generada: ${(res as Record<string,string>).lista_caza_id?.slice(0, 8)}`); },
  });
  const optimizarMutation = useMutation({
    mutationFn: () => importScorerApi.optimizarCarrito(apiKey),
    onSuccess: (res) => { showToast(`Knapsack: ${(res as Record<string,number>).n_productos ?? 0} prods, ${(res as Record<string,number>).peso_total_kg ?? 0} kg`); },
  });

  return (
    <div className="flex h-full gap-4">
      {toast && <div className="fixed bottom-4 right-4 z-50 rounded-xl bg-gray-900 px-4 py-2.5 text-sm text-white shadow-lg">{toast}</div>}

      {/* Panel izquierdo: lista de carritos */}
      <div className="w-72 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Carritos</h2>
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            <Plus className="h-3.5 w-3.5" /> Nuevo
          </button>
        </div>

        {showNew && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
            <input type="text" value={newNombre} onChange={(e) => setNewNombre(e.target.value)}
              placeholder="Nombre del carrito" autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter' && newNombre.trim()) createMutation.mutate({ nombre: newNombre }); if (e.key === 'Escape') setShowNew(false); }}
              className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2">
              <button onClick={() => { if (newNombre.trim()) createMutation.mutate({ nombre: newNombre }); }}
                disabled={!newNombre.trim() || createMutation.isPending}
                className="flex-1 rounded-lg bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50">Crear</button>
              <button onClick={() => setShowNew(false)} className="rounded-lg border px-2 py-1 text-xs text-gray-500">×</button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
        ) : (
          <div className="space-y-1.5">
            {(carritos as ISCarrito[]).filter((c) => !c.es_plantilla).map((c) => {
              const peso = c.resumen ? (c.resumen.peso_total_kg as number) : 0;
              return (
                <button key={c.id} onClick={() => setSelected(c.id)}
                  className={`w-full text-left rounded-xl border p-3 transition-all ${selected === c.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">{c.nombre}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ml-1 ${ESTADO_COLORS[c.estado]}`}>{c.estado}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {c.total_items} ítems{peso > 0 ? ` · ${peso.toFixed(1)} kg` : ''}
                    {c.cotizacion_mep_snapshot ? ` · MEP $${c.cotizacion_mep_snapshot.toFixed(0)}` : ''}
                  </div>
                </button>
              );
            })}
            {(carritos as ISCarrito[]).filter((c) => !c.es_plantilla).length === 0 && !showNew && (
              <div className="text-xs text-gray-400 text-center py-4">No hay carritos.</div>
            )}
          </div>
        )}
      </div>

      {/* Panel derecho: detalle */}
      {carrito ? (
        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{carrito.nombre}</h1>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ESTADO_COLORS[carrito.estado]}`}>{carrito.estado}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Transiciones de estado */}
              {(TRANSICIONES[carrito.estado] ?? []).map((e) => (
                <button key={e} onClick={() => estadoMutation.mutate({ id: carrito.id, estado: e })}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50">
                  → {e}
                </button>
              ))}
              {carrito.estado === 'borrador' && (
                <button onClick={() => cotizarMutation.mutate(carrito.id)} disabled={cotizarMutation.isPending || carrito.total_items === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                  <RefreshCw className="h-3.5 w-3.5" /> Cotizar
                </button>
              )}
              <button onClick={() => optimizarMutation.mutate()} disabled={optimizarMutation.isPending}
                title="Optimizador knapsack" className="rounded-xl border border-gray-200 p-1.5 hover:bg-gray-50 text-gray-500">
                <Zap className="h-4 w-4" />
              </button>
              {carrito.items.some((i) => i.modo_compra === 'outlet') && (
                <button onClick={() => listaCazaMutation.mutate(carrito.id)} disabled={listaCazaMutation.isPending}
                  title="Generar lista de caza" className="rounded-xl border border-gray-200 p-1.5 hover:bg-gray-50 text-gray-500">
                  <FileText className="h-4 w-4" />
                </button>
              )}
              <button onClick={() => { if (!confirm('¿Eliminar este carrito?')) return; deleteMutation.mutate(carrito.id); }}
                className="rounded-xl border border-gray-200 p-1.5 hover:bg-red-50 hover:text-red-600 text-gray-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex gap-4">
            {/* Items */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">{carrito.total_items} ítems</span>
                {carrito.estado === 'borrador' && (
                  <button onClick={() => setShowAddProduct(true)}
                    className="flex items-center gap-1 rounded-lg border border-dashed border-blue-300 px-3 py-1 text-xs text-blue-600 hover:bg-blue-50">
                    <Plus className="h-3.5 w-3.5" /> Agregar producto
                  </button>
                )}
              </div>

              {carrito.items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">
                  <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  Carrito vacío. Agregá productos o usá el optimizador.
                </div>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
                  {carrito.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{item.producto_nombre}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          <span>Cant: {item.cantidad}</span>
                          <span className="mx-1.5">·</span>
                          <span>${item.precio_usd_locked.toFixed(2)}/u</span>
                          <span className="mx-1.5">·</span>
                          <span>{item.peso_kg_locked.toFixed(2)} kg/u</span>
                          <span className="mx-1.5">·</span>
                          <span className={item.modo_compra === 'outlet' ? 'text-orange-500' : 'text-blue-500'}>{item.modo_compra}</span>
                          {item.comprado && <span className="ml-1.5 text-green-600 flex items-center gap-0.5 inline-flex"><CheckCircle className="h-3 w-3" /> comprado</span>}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-700 shrink-0">${(item.precio_usd_locked * item.cantidad).toFixed(2)}</div>
                      {carrito.estado === 'borrador' && (
                        <button onClick={() => removeItemMutation.mutate({ carritoId: carrito.id, itemId: item.id })}
                          className="rounded-lg p-1 text-gray-300 hover:text-red-500 shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Modal agregar producto */}
              {showAddProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl max-h-[80vh] flex flex-col">
                    <div className="px-5 py-4 border-b flex items-center justify-between shrink-0">
                      <h3 className="font-semibold">Agregar producto al carrito</h3>
                      <button onClick={() => setShowAddProduct(false)} className="text-gray-400 text-xl">×</button>
                    </div>
                    <div className="overflow-y-auto flex-1 divide-y divide-gray-100">
                      {(productos as ISProducto[]).filter((p) => !p.descartado && p.mejor_precio_usd).map((p) => (
                        <button key={p.id} onClick={() => addItemMutation.mutate({
                          carritoId: carrito.id, productoId: p.id,
                          precio: p.mejor_precio_usd!, peso: p.peso_kg ?? 1,
                        })}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left">
                          <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium shrink-0 ${p.semaforo ? (p.semaforo === 'verde' ? 'bg-green-100 text-green-700' : p.semaforo === 'amarillo' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700') : 'bg-gray-100 text-gray-400'}`}>
                            {p.semaforo?.charAt(0).toUpperCase() ?? '?'}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm truncate">{p.nombre}</div>
                            <div className="text-xs text-gray-400">${p.mejor_precio_usd?.toFixed(2)} · {p.peso_kg ?? '?'} kg · {p.rubro_nombre}</div>
                          </div>
                          {p.ratio_margen && <span className="text-xs font-medium text-gray-600 shrink-0">{p.ratio_margen.toFixed(2)}×</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Resumen lateral */}
            <div className="w-64 shrink-0">
              <div className="text-sm font-medium text-gray-700 mb-2">Resumen</div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <ResumenPanel resumen={carrito.resumen} alertas={carrito.alertas} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
          <div className="text-center">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 text-gray-200" />
            <p className="text-sm">Seleccioná un carrito o creá uno nuevo</p>
          </div>
        </div>
      )}
    </div>
  );
}
