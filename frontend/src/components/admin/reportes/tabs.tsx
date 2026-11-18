'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  COLORES,
  ars,
  cantidad,
  descargarCsv,
  dias,
  etiquetaPeriodo,
  fecha,
  fetchReporte,
  num,
  pct,
  type ClienteRow,
  type ClientesData,
  type CicloData,
  type Endpoint,
  type PendienteRow,
  type ProductoRow,
  type ProductosData,
  type ResumenData,
  type StockData,
  type StockItem,
  type VendedoraRow,
  type VendedorasData,
  type VentasData,
} from '@/lib/reportes';
import { AreaComparativa, BarrasApiladas, BarrasHorizontales, Sparkline } from './ChartsLazy';
import {
  Advertencias,
  BotonCsv,
  Cargando,
  ErrorBox,
  KpiCard,
  ListaOrdenable,
  Panel,
  Segmentado,
  Vacio,
  Variacion,
  type Columna,
} from './ui';

export interface TabProps {
  apiKey: string;
  params: URLSearchParams;
  extra: Record<string, string>;
  setExtra: (cambios: Record<string, string | null>) => void;
}

function useReporte<T>(endpoint: Endpoint, params: URLSearchParams, apiKey: string) {
  const qs = params.toString();
  return useQuery<T>({
    queryKey: ['reportes', endpoint, qs],
    queryFn: () => fetchReporte<T>(endpoint, params, apiKey),
    staleTime: 60_000,
    retry: 1,
  });
}

function Encabezado({ endpoint, params, apiKey, children }: { endpoint: Endpoint; params: URLSearchParams; apiKey: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      <BotonCsv onExport={() => descargarCsv(endpoint, params, apiKey)} />
    </div>
  );
}

function conParams(base: URLSearchParams, extra: Record<string, string | undefined>): URLSearchParams {
  const p = new URLSearchParams(base);
  Object.entries(extra).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  return p;
}

const productoTitulo = (nombre: string, codigo: string | null) => (
  <span className="block min-w-0">
    <span className="block truncate">{nombre}</span>
    {codigo && <span className="block text-[11px] font-normal text-zinc-400">{codigo}</span>}
  </span>
);

// ─── Resumen ─────────────────────────────────────────────────────────────

export function ResumenTab({ apiKey, params }: TabProps) {
  const q = useReporte<ResumenData>('resumen', params, apiKey);
  if (q.isLoading) return <Cargando />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const k = d.kpis;
  const v = d.variacion;
  const serie = d.serie;
  const agrupar = d.filtros.agrupar;
  const spark = (f: (p: (typeof serie)[number]) => number) => serie.map(f);
  const comparado = serie.map((p, i) => ({
    etiqueta: etiquetaPeriodo(p.periodo, agrupar),
    tooltipLabel: fecha(p.periodo),
    actual: num(p.facturacion) ?? 0,
    anterior: d.serie_anterior[i] ? num(d.serie_anterior[i].facturacion) ?? 0 : null,
  }));
  const sinDatos = k.ventas === 0 && d.anterior.ventas === 0;

  return (
    <div className="space-y-3">
      <Encabezado endpoint="resumen" params={params} apiKey={apiKey}>
        <p className="text-xs text-zinc-500">
          Contra {fecha(d.periodo_anterior.desde)} – {fecha(d.periodo_anterior.hasta)}
        </p>
      </Encabezado>
      <Advertencias items={d.advertencias} />
      {sinDatos ? (
        <Vacio />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard titulo="Facturación" valor={ars(k.facturacion)} variacion={<Variacion valor={v.facturacion} />}>
              <Sparkline datos={spark((p) => num(p.facturacion) ?? 0)} />
            </KpiCard>
            <KpiCard titulo="Ventas" valor={cantidad(k.ventas)} variacion={<Variacion valor={v.ventas} />}>
              <Sparkline datos={spark((p) => p.ventas)} />
            </KpiCard>
            <KpiCard titulo="Unidades" valor={cantidad(k.unidades)} variacion={<Variacion valor={v.unidades} />}>
              <Sparkline datos={spark((p) => p.unidades)} />
            </KpiCard>
            <KpiCard titulo="Ticket promedio" valor={ars(k.ticket_promedio)} variacion={<Variacion valor={v.ticket_promedio} />}>
              <Sparkline datos={spark((p) => (p.ventas ? (num(p.facturacion) ?? 0) / p.ventas : 0))} />
            </KpiCard>
            <KpiCard
              titulo="Margen bruto"
              valor={ars(k.margen_bruto)}
              variacion={<Variacion valor={v.margen_bruto} />}
              detalle={k.items_sin_costo ? 'incompleto' : undefined}
            />
            <KpiCard titulo="Margen %" valor={pct(k.margen_pct)} variacion={<Variacion valor={v.margen_pct} puntos />} />
            <KpiCard titulo="Clientes únicos" valor={cantidad(k.clientes_unicos)} variacion={<Variacion valor={v.clientes_unicos} />} />
            <KpiCard
              titulo="% que repite"
              valor={pct(k.pct_clientes_repiten)}
              variacion={<Variacion valor={v.pct_clientes_repiten} puntos />}
            />
            <KpiCard
              titulo="Cobranza de lo vendido"
              valor={pct(k.pct_cobranza)}
              variacion={<Variacion valor={v.pct_cobranza} puntos />}
              detalle={`${ars(k.cobrado)} cobrado`}
            />
            <KpiCard
              titulo="Pendiente de cobro"
              valor={ars(k.pendiente_cobro)}
              detalle="de las ventas del período"
            />
            <KpiCard
              titulo="Cobrado en el período"
              valor={ars(k.cobrado_en_periodo)}
              variacion={<Variacion valor={v.cobrado_en_periodo} />}
            />
            <KpiCard
              titulo="Días entrega → cobro"
              valor={dias(k.dias_entrega_cobro)}
              variacion={<Variacion valor={v.dias_entrega_cobro} enDias inverso />}
              detalle={k.ventas_con_dias_entrega_cobro ? `${cantidad(k.ventas_con_dias_entrega_cobro)} ventas` : 'sin datos'}
            />
          </div>
          <Panel
            titulo="Facturación"
            accion={
              <span className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-3 rounded-sm" style={{ background: COLORES.principal }} /> Este período
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-0 w-3 border-t-2 border-dashed" style={{ borderColor: COLORES.secundario }} /> Anterior
                </span>
              </span>
            }
          >
            <AreaComparativa data={comparado} />
          </Panel>
        </>
      )}
    </div>
  );
}

// ─── Ventas ──────────────────────────────────────────────────────────────

const AGRUPAR = [
  { id: 'auto', label: 'Auto' },
  { id: 'dia', label: 'Día' },
  { id: 'semana', label: 'Semana' },
  { id: 'mes', label: 'Mes' },
] as const;

const COLOR_CANAL: Record<string, string> = { admin: COLORES.principal, vendedor: COLORES.secundario };

export function VentasTab({ apiKey, params, extra, setExtra }: TabProps) {
  const agrupar = extra.agrupar || 'auto';
  const p = conParams(params, { agrupar: agrupar === 'auto' ? undefined : agrupar });
  const q = useReporte<VentasData>('ventas', p, apiKey);

  const header = (
    <Encabezado endpoint="ventas" params={p} apiKey={apiKey}>
      <Segmentado
        etiqueta="Agrupar por"
        opciones={AGRUPAR.map((a) => ({ id: a.id, label: a.label }))}
        valor={agrupar as (typeof AGRUPAR)[number]['id']}
        onChange={(v) => setExtra({ agrupar: v === 'auto' ? null : v })}
      />
    </Encabezado>
  );
  if (q.isLoading) return <div className="space-y-3">{header}<Cargando filas={1} /></div>;
  if (q.isError) return <div className="space-y-3">{header}<ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data!;
  const datos = d.serie.map((s) => ({
    etiqueta: etiquetaPeriodo(s.periodo, d.agrupar),
    tooltipLabel: d.agrupar === 'semana' ? `Semana del ${fecha(s.periodo)}` : fecha(s.periodo),
    ...Object.fromEntries(d.canales.map((c) => [c.id, num(s.por_canal?.[c.id]?.facturacion) ?? 0])),
  }));
  type Fila = (typeof d.serie)[number];
  const columnas: Columna<Fila>[] = [
    { key: 'periodo', label: 'Período', render: (r) => (d.agrupar === 'semana' ? `Sem. ${fecha(r.periodo)}` : fecha(r.periodo)), sort: (r) => r.periodo, mobile: 'titulo' },
    { key: 'facturacion', label: 'Facturación', render: (r) => ars(r.facturacion), sort: (r) => num(r.facturacion), align: 'right' },
    { key: 'cobrado', label: 'Cobrado', render: (r) => ars(r.cobrado ?? null), sort: (r) => num(r.cobrado ?? null), align: 'right' },
    { key: 'ventas', label: 'Ventas', render: (r) => cantidad(r.ventas), sort: (r) => r.ventas, align: 'right' },
    { key: 'unidades', label: 'Unidades', render: (r) => cantidad(r.unidades), sort: (r) => r.unidades, align: 'right' },
    ...d.canales.map<Columna<Fila>>((c) => ({
      key: `canal_${c.id}`,
      label: c.nombre,
      render: (r) => ars(r.por_canal?.[c.id]?.facturacion ?? null),
      sort: (r) => num(r.por_canal?.[c.id]?.facturacion ?? null),
      align: 'right',
    })),
  ];
  return (
    <div className="space-y-3">
      {header}
      <Advertencias items={d.advertencias} />
      {d.total.ventas === 0 ? (
        <Vacio />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard titulo="Facturación" valor={ars(d.total.facturacion)} />
            <KpiCard titulo="Cobrado" valor={ars(d.total.cobrado)} detalle={`${pct(d.total.pct_cobranza)} de lo vendido`} />
            <KpiCard titulo="Ventas" valor={cantidad(d.total.ventas)} />
            <KpiCard titulo="Unidades" valor={cantidad(d.total.unidades)} />
          </div>
          <Panel titulo="Facturación por canal">
            <BarrasApiladas
              data={datos}
              series={d.canales.map((c) => ({ key: c.id, nombre: c.nombre, color: COLOR_CANAL[c.id] ?? COLORES.contexto }))}
            />
          </Panel>
          <ListaOrdenable
            filas={d.serie.filter((s) => s.ventas > 0)}
            columnas={columnas}
            clave={(r) => r.periodo}
            ordenInicial={{ key: 'periodo', dir: 'desc' }}
          />
        </>
      )}
    </div>
  );
}

// ─── Productos ───────────────────────────────────────────────────────────

const METRICAS = [
  { id: 'facturacion', label: 'Facturación' },
  { id: 'unidades', label: 'Unidades' },
  { id: 'margen', label: 'Margen' },
] as const;
type Metrica = (typeof METRICAS)[number]['id'];

export function ProductosTab({ apiKey, params, extra, setExtra }: TabProps) {
  const metrica: Metrica = METRICAS.some((m) => m.id === extra.metrica) ? (extra.metrica as Metrica) : 'facturacion';
  const q = useReporte<ProductosData>('productos', params, apiKey);
  if (q.isLoading) return <Cargando />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const top10 = d.productos
    .filter((p) => num(p[metrica]) !== null)
    .sort((a, b) => (num(b[metrica]) ?? 0) - (num(a[metrica]) ?? 0))
    .slice(0, 10)
    .map((p) => ({ nombre: p.nombre, valor: num(p[metrica]) ?? 0 }));

  const columnas: Columna<ProductoRow>[] = [
    { key: 'nombre', label: 'Producto', render: (r) => productoTitulo(r.nombre, r.codigo_interno), sort: (r) => r.nombre.toLowerCase(), mobile: 'titulo' },
    { key: 'unidades', label: 'Unidades', render: (r) => cantidad(r.unidades), sort: (r) => r.unidades, align: 'right' },
    { key: 'facturacion', label: 'Facturación', render: (r) => ars(r.facturacion), sort: (r) => num(r.facturacion), align: 'right' },
    {
      key: 'margen',
      label: 'Margen',
      render: (r) =>
        r.margen === null ? (
          <span className="text-xs text-amber-700">Sin costo</span>
        ) : (
          <span title={r.costo_actual ? 'Incluye costo actual del proveedor' : undefined}>
            {ars(r.margen)} <span className="text-xs text-zinc-400">{pct(r.margen_pct)}</span>
            {r.costo_actual && <span className="ml-1 text-[10px] text-amber-600">*</span>}
          </span>
        ),
      sort: (r) => num(r.margen),
      align: 'right',
    },
    { key: 'stock', label: 'Stock', render: (r) => cantidad(r.stock), sort: (r) => r.stock, align: 'right' },
    {
      key: 'cobertura',
      label: 'Cobertura',
      render: (r) => (r.dias_cobertura === null ? '—' : `${cantidad(Math.round(Number(r.dias_cobertura)))} d`),
      sort: (r) => num(r.dias_cobertura),
      align: 'right',
    },
    { key: 'ultima', label: 'Última venta', render: (r) => fecha(r.ultima_venta), sort: (r) => r.ultima_venta, align: 'right' },
  ];

  return (
    <div className="space-y-3">
      <Encabezado endpoint="productos" params={params} apiKey={apiKey}>
        <p className="text-xs text-zinc-500">{cantidad(d.total_productos)} productos vendidos</p>
      </Encabezado>
      <Advertencias items={d.advertencias} />
      {d.productos.length === 0 ? (
        <Vacio />
      ) : (
        <>
          <Panel
            titulo="Top 10"
            accion={
              <Segmentado
                etiqueta="Métrica del ranking"
                opciones={METRICAS.map((m) => ({ id: m.id, label: m.label }))}
                valor={metrica}
                onChange={(v) => setExtra({ metrica: v === 'facturacion' ? null : v })}
              />
            }
          >
            {top10.length ? (
              <BarrasHorizontales data={top10} formato={metrica === 'unidades' ? 'cantidad' : 'ars'} />
            ) : (
              <Vacio texto="Ningún producto tiene costo cargado." />
            )}
          </Panel>
          <ListaOrdenable
            filas={d.productos}
            columnas={columnas}
            clave={(r) => r.product_id}
            ordenInicial={{ key: 'facturacion', dir: 'desc' }}
          />
          <p className="text-[11px] text-zinc-400">* margen calculado con el costo actual del proveedor (sin compras previas a la venta).</p>
        </>
      )}
    </div>
  );
}

// ─── Stock parado ────────────────────────────────────────────────────────

const DIAS_MIN = [
  { id: '30', label: '30 d' },
  { id: '60', label: '60 d' },
  { id: '90', label: '90 d' },
  { id: '180', label: '180 d' },
] as const;

export function StockTab({ apiKey, params, extra, setExtra }: TabProps) {
  const diasMin = extra.dias_min || '60';
  const p = new URLSearchParams();
  const dep = params.get('deposito_id');
  if (dep) p.set('deposito_id', dep);
  p.set('dias_min', diasMin);
  const q = useReporte<StockData>('stock-inmovilizado', p, apiKey);

  const header = (
    <Encabezado endpoint="stock-inmovilizado" params={p} apiKey={apiKey}>
      <span className="text-xs text-zinc-500">Sin ventas hace</span>
      <Segmentado
        etiqueta="Días sin venta"
        opciones={DIAS_MIN.map((x) => ({ id: x.id, label: x.label }))}
        valor={diasMin as (typeof DIAS_MIN)[number]['id']}
        onChange={(v) => setExtra({ dias_min: v === '60' ? null : v })}
      />
    </Encabezado>
  );
  if (q.isLoading) return <div className="space-y-3">{header}<Cargando /></div>;
  if (q.isError) return <div className="space-y-3">{header}<ErrorBox error={q.error} onRetry={() => q.refetch()} /></div>;
  const d = q.data!;
  const columnas: Columna<StockItem>[] = [
    { key: 'nombre', label: 'Producto', render: (r) => productoTitulo(r.nombre, r.codigo_interno), sort: (r) => r.nombre.toLowerCase(), mobile: 'titulo' },
    { key: 'deposito', label: 'Depósito', render: (r) => r.deposito, sort: (r) => r.deposito },
    { key: 'stock', label: 'Stock', render: (r) => cantidad(r.stock), sort: (r) => r.stock, align: 'right' },
    {
      key: 'valor',
      label: 'Valor a costo',
      render: (r) => (r.valor_costo === null ? <span className="text-xs text-amber-700">Sin costo</span> : <>{ars(r.valor_costo)}{r.costo_actual && <span className="ml-1 text-[10px] text-amber-600">*</span>}</>),
      sort: (r) => num(r.valor_costo),
      align: 'right',
    },
    {
      key: 'dias',
      label: 'Días sin venta',
      render: (r) => (r.dias_sin_venta === null ? '—' : <>{cantidad(r.dias_sin_venta)}{r.nunca_vendido && <span className="ml-1 text-[10px] text-zinc-400">nunca vendido</span>}</>),
      sort: (r) => r.dias_sin_venta,
      align: 'right',
    },
    { key: 'ultima', label: 'Última venta', render: (r) => fecha(r.ultima_venta), sort: (r) => r.ultima_venta, align: 'right' },
  ];
  return (
    <div className="space-y-3">
      {header}
      <Advertencias items={d.advertencias} />
      {d.items.length === 0 ? (
        <Vacio texto="No hay stock parado con este criterio." />
      ) : (
        <>
          <Panel>
            <p className="text-xs font-medium text-zinc-500">Plata parada (a costo)</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 tabular-nums">{ars(d.total_valor_costo)}</p>
            <p className="mb-3 text-xs text-zinc-400">
              {cantidad(d.items.length)} productos · {cantidad(d.items.reduce((a, i) => a + i.stock, 0))} unidades
            </p>
            <BarrasHorizontales data={d.por_deposito.map((x) => ({ nombre: x.deposito, valor: num(x.valor_costo) ?? 0 }))} />
          </Panel>
          <ListaOrdenable
            filas={d.items}
            columnas={columnas}
            clave={(r) => `${r.deposito_id ?? 'na'}-${r.product_id}`}
            ordenInicial={{ key: 'valor', dir: 'desc' }}
          />
          <p className="text-[11px] text-zinc-400">* valuado al costo actual del proveedor.</p>
        </>
      )}
    </div>
  );
}

// ─── Vendedoras ──────────────────────────────────────────────────────────

export function VendedorasTab({ apiKey, params }: TabProps) {
  const q = useReporte<VendedorasData>('vendedoras', params, apiKey);
  if (q.isLoading) return <Cargando />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const columnas: Columna<VendedoraRow>[] = [
    { key: 'nombre', label: 'Vendedora', render: (r) => r.nombre, sort: (r) => r.nombre.toLowerCase(), mobile: 'titulo' },
    { key: 'facturacion', label: 'Facturación', render: (r) => ars(r.facturacion), sort: (r) => num(r.facturacion), align: 'right' },
    { key: 'ventas', label: 'Ventas', render: (r) => cantidad(r.ventas), sort: (r) => r.ventas, align: 'right' },
    { key: 'unidades', label: 'Unidades', render: (r) => cantidad(r.unidades), sort: (r) => r.unidades, align: 'right' },
    { key: 'ticket', label: 'Ticket prom.', render: (r) => ars(r.ticket_promedio), sort: (r) => num(r.ticket_promedio), align: 'right' },
    { key: 'clientes', label: 'Clientes', render: (r) => cantidad(r.clientes_unicos), sort: (r) => r.clientes_unicos, align: 'right' },
    { key: 'cobranza', label: 'Cobranza', render: (r) => pct(r.pct_cobranza), sort: (r) => num(r.pct_cobranza), align: 'right' },
    { key: 'pendiente', label: 'Pend. cobro', render: (r) => ars(r.pendiente_cobro), sort: (r) => num(r.pendiente_cobro), align: 'right' },
    { key: 'dias_ec', label: 'Entrega → cobro', render: (r) => dias(r.dias_entrega_cobro), sort: (r) => num(r.dias_entrega_cobro), align: 'right' },
    {
      key: 'margen',
      label: 'Margen',
      render: (r) => (
        <>
          {ars(r.margen)} <span className="text-xs text-zinc-400">{pct(r.margen_pct)}</span>
          {r.items_sin_costo > 0 && <span className="ml-0.5 text-[10px] text-amber-600" title={`${r.items_sin_costo} ítems sin costo: margen parcial`}>*</span>}
        </>
      ),
      sort: (r) => num(r.margen),
      align: 'right',
    },
  ];
  return (
    <div className="space-y-3">
      <Encabezado endpoint="vendedoras" params={params} apiKey={apiKey} />
      <Advertencias items={d.advertencias} />
      {d.vendedoras.length === 0 ? (
        <Vacio />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel titulo="Facturación">
              <BarrasHorizontales data={d.vendedoras.map((v) => ({ nombre: v.nombre, valor: num(v.facturacion) ?? 0 }))} />
            </Panel>
            <Panel titulo="Ticket promedio">
              <BarrasHorizontales
                color={COLORES.secundario}
                data={[...d.vendedoras]
                  .sort((a, b) => (num(b.ticket_promedio) ?? 0) - (num(a.ticket_promedio) ?? 0))
                  .map((v) => ({ nombre: v.nombre, valor: num(v.ticket_promedio) ?? 0 }))}
              />
            </Panel>
          </div>
          <ListaOrdenable
            filas={d.vendedoras}
            columnas={columnas}
            clave={(r) => r.vendedora_id}
            ordenInicial={{ key: 'facturacion', dir: 'desc' }}
          />
          <p className="text-[11px] text-zinc-400">* margen parcial: hay ítems sin costo cargado.</p>
        </>
      )}
    </div>
  );
}

// ─── Clientes ────────────────────────────────────────────────────────────

const VISTA_CLIENTES = [
  { id: 'todos', label: 'Top clientes' },
  { id: 'una', label: 'Una sola compra' },
] as const;

export function ClientesTab({ apiKey, params, extra, setExtra }: TabProps) {
  const vista = extra.vista === 'una' ? 'una' : 'todos';
  const p = conParams(params, { top: '200', solo_una_compra: vista === 'una' ? 'true' : undefined });
  const q = useReporte<ClientesData>('clientes', p, apiKey);
  if (q.isLoading) return <Cargando />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const conContacto = d.clientes.some((c) => 'telefono' in c);
  const columnas: Columna<ClienteRow>[] = [
    {
      key: 'nombre',
      label: 'Cliente',
      render: (r) => (
        <span className="block min-w-0">
          <span className="block truncate">{r.nombre}</span>
          {r.localidad && <span className="block text-[11px] font-normal text-zinc-400">{r.localidad}</span>}
        </span>
      ),
      sort: (r) => r.nombre.toLowerCase(),
      mobile: 'titulo',
    },
    { key: 'facturacion', label: 'Facturación', render: (r) => ars(r.facturacion), sort: (r) => num(r.facturacion), align: 'right' },
    { key: 'ventas', label: 'Ventas', render: (r) => cantidad(r.ventas), sort: (r) => r.ventas, align: 'right' },
    { key: 'compras', label: 'Compras totales', render: (r) => cantidad(r.compras_totales), sort: (r) => r.compras_totales, align: 'right' },
    {
      key: 'frecuencia',
      label: 'Frecuencia',
      render: (r) => (r.dias_promedio_entre_compras === null ? '—' : `cada ${cantidad(Math.round(Number(r.dias_promedio_entre_compras)))} d`),
      sort: (r) => num(r.dias_promedio_entre_compras),
      align: 'right',
    },
    { key: 'ultima', label: 'Última compra', render: (r) => fecha(r.ultima_compra), sort: (r) => r.ultima_compra, align: 'right' },
    ...(conContacto
      ? [{ key: 'telefono', label: 'Teléfono', render: (r: ClienteRow) => r.telefono || '—' } as Columna<ClienteRow>]
      : []),
  ];
  return (
    <div className="space-y-3">
      <Encabezado endpoint="clientes" params={p} apiKey={apiKey}>
        <Segmentado
          etiqueta="Vista"
          opciones={VISTA_CLIENTES.map((x) => ({ id: x.id, label: x.label }))}
          valor={vista}
          onChange={(v) => setExtra({ vista: v === 'todos' ? null : v })}
        />
      </Encabezado>
      <Advertencias items={d.advertencias} />
      <div className="grid grid-cols-3 gap-3">
        <KpiCard titulo="% que repite" valor={pct(d.kpis.pct_clientes_repiten)} detalle={`${cantidad(d.kpis.clientes_repiten)} clientes`} />
        <KpiCard titulo="Clientes únicos" valor={cantidad(d.kpis.clientes_unicos)} />
        <KpiCard titulo="Una sola compra" valor={cantidad(d.kpis.clientes_una_sola_compra)} />
      </div>
      <ListaOrdenable
        filas={d.clientes}
        columnas={columnas}
        clave={(r) => r.nombre.toLowerCase()}
        ordenInicial={{ key: 'facturacion', dir: 'desc' }}
        vacio="No hay clientes con nombre en este período."
      />
    </div>
  );
}

// ─── Cobranza (ciclo de vida) ────────────────────────────────────────────

function TiempoCard({ titulo, stats }: { titulo: string; stats: CicloData['tiempos']['venta_entrega'] }) {
  return (
    <KpiCard
      titulo={titulo}
      valor={dias(stats.promedio)}
      detalle={stats.ventas ? `mediana ${dias(stats.mediana)} · ${cantidad(stats.ventas)} ventas` : 'sin ventas con fechas reales'}
    />
  );
}

const PENDIENTES_VISIBLES = 20;

export function CobranzaTab({ apiKey, params }: TabProps) {
  const q = useReporte<CicloData>('ciclo', params, apiKey);
  const [verTodas, setVerTodas] = useState(false);
  if (q.isLoading) return <Cargando />;
  if (q.isError) return <ErrorBox error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data!;
  const t = d.tiempos;

  type FilaVend = CicloData['por_vendedora'][number];
  const colVend: Columna<FilaVend>[] = [
    { key: 'nombre', label: 'Vendedora', render: (r) => r.nombre, sort: (r) => r.nombre.toLowerCase(), mobile: 'titulo' },
    { key: 've', label: 'Venta → entrega', render: (r) => dias(r.dias_venta_entrega), sort: (r) => num(r.dias_venta_entrega), align: 'right' },
    { key: 'vc', label: 'Venta → cobro', render: (r) => dias(r.dias_venta_cobro), sort: (r) => num(r.dias_venta_cobro), align: 'right' },
    { key: 'ec', label: 'Entrega → cobro', render: (r) => dias(r.dias_entrega_cobro), sort: (r) => num(r.dias_entrega_cobro), align: 'right' },
    { key: 'pc', label: 'Por cobrar', render: (r) => ars(r.por_cobrar), sort: (r) => num(r.por_cobrar), align: 'right' },
    { key: 'pe', label: 'Por entregar', render: (r) => ars(r.por_entregar), sort: (r) => num(r.por_entregar), align: 'right' },
  ];

  const colPend: Columna<PendienteRow>[] = [
    {
      key: 'venta',
      label: 'Venta',
      render: (r) => (
        <span className="block min-w-0">
          <span className="block truncate">#{r.venta_id} · {r.cliente || 'Sin cliente'}</span>
          <span className="block text-[11px] font-normal text-zinc-400">{r.vendedora}</span>
        </span>
      ),
      sort: (r) => r.venta_id,
      mobile: 'titulo',
    },
    { key: 'fecha', label: 'Vendida', render: (r) => fecha(r.fecha_venta), sort: (r) => r.fecha_venta, align: 'right' },
    {
      key: 'entrega',
      label: 'Entregada',
      render: (r) =>
        r.primera_entrega ? (
          <>
            {fecha(r.primera_entrega)}
            {r.primera_entrega_fecha_real === false && <span className="ml-1 text-[10px] text-amber-600" title="Fecha aproximada">~</span>}
          </>
        ) : (
          '—'
        ),
      sort: (r) => r.primera_entrega,
      align: 'right',
    },
    { key: 'pc', label: 'Por cobrar', render: (r) => ars(r.por_cobrar), sort: (r) => num(r.por_cobrar), align: 'right' },
    {
      key: 'dc',
      label: 'Días sin cobrar',
      render: (r) => (r.dias_desde_entrega === null ? '—' : cantidad(r.dias_desde_entrega)),
      sort: (r) => r.dias_desde_entrega,
      align: 'right',
    },
    { key: 'pe', label: 'Por entregar', render: (r) => ars(r.por_entregar), sort: (r) => num(r.por_entregar), align: 'right' },
    { key: 'dv', label: 'Días desde venta', render: (r) => cantidad(r.dias_desde_venta), sort: (r) => r.dias_desde_venta, align: 'right' },
  ];

  const barrasAntiguedad = (a: CicloData['por_cobrar']) =>
    a.ventas ? (
      <BarrasHorizontales data={a.antiguedad.map((x) => ({ nombre: x.rango, valor: num(x.monto) ?? 0 }))} />
    ) : (
      <p className="py-6 text-center text-sm text-zinc-400">Nada pendiente.</p>
    );

  return (
    <div className="space-y-3">
      <Encabezado endpoint="ciclo" params={params} apiKey={apiKey}>
        {d.fechas_reales_desde && (
          <p className="text-xs text-zinc-500">Días con fechas reales desde {fecha(d.fechas_reales_desde)}</p>
        )}
      </Encabezado>
      <Advertencias items={d.advertencias} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          titulo="Cobranza de lo vendido"
          valor={pct(d.cobranza.pct_cobranza)}
          detalle={`${ars(d.cobranza.cobrado)} de ${ars(d.cobranza.facturacion)}`}
        />
        <KpiCard titulo="Cobrado en el período" valor={ars(d.caja.total)} detalle={`${cantidad(d.caja.pagos)} cobros`} />
        <KpiCard titulo="Por cobrar hoy" valor={ars(d.por_cobrar.total)} detalle={`${cantidad(d.por_cobrar.ventas)} ventas entregadas`} />
        <KpiCard titulo="Por entregar hoy" valor={ars(d.por_entregar.total)} detalle={`${cantidad(d.por_entregar.ventas)} ventas`} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TiempoCard titulo="Venta → entrega" stats={t.venta_entrega} />
        <TiempoCard titulo="Venta → cobro" stats={t.venta_cobro} />
        <TiempoCard titulo="Entrega → cobro" stats={t.entrega_cobro} />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel titulo="Demora entrega → cobro (ventas)">
          {t.entrega_cobro.ventas ? (
            <BarrasHorizontales
              formato="cantidad"
              data={d.distribucion_entrega_cobro.map((x) => ({ nombre: x.rango, valor: x.ventas }))}
            />
          ) : (
            <p className="py-6 text-center text-sm text-zinc-400">Sin ventas entregadas y cobradas con fechas reales.</p>
          )}
        </Panel>
        <Panel titulo="Por cobrar, por antigüedad desde la entrega">{barrasAntiguedad(d.por_cobrar)}</Panel>
        <Panel titulo="Por entregar, por antigüedad desde la venta">{barrasAntiguedad(d.por_entregar)}</Panel>
      </div>

      {d.por_vendedora.length > 0 && (
        <Panel titulo="Por vendedora">
          <ListaOrdenable filas={d.por_vendedora} columnas={colVend} clave={(r) => r.vendedora_id} ordenInicial={{ key: 'pc', dir: 'desc' }} />
        </Panel>
      )}

      <Panel titulo={`Ventas pendientes (${cantidad(d.pendientes.length)})`}>
        <ListaOrdenable
          filas={verTodas ? d.pendientes : d.pendientes.slice(0, PENDIENTES_VISIBLES)}
          columnas={colPend}
          clave={(r) => r.venta_id}
          ordenInicial={{ key: 'pc', dir: 'desc' }}
          vacio="No hay ventas pendientes de cobro ni de entrega."
        />
        {d.pendientes.length > PENDIENTES_VISIBLES && (
          <button
            type="button"
            onClick={() => setVerTodas((v) => !v)}
            className="mt-2 w-full rounded-lg py-2 text-sm font-medium text-[#2c5c88] ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            {verTodas ? 'Ver menos' : `Ver todas (${cantidad(d.pendientes.length)})`}
          </button>
        )}
        <p className="mt-2 text-[11px] text-zinc-400">
          Se muestran las de mayor monto por cobrar. ~ fecha de entrega aproximada (anterior al registro de fechas).
        </p>
      </Panel>
    </div>
  );
}
