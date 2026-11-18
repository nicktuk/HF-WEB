// Módulo de reportes del admin: tipos, llamadas a la API y formato es-AR.
// Los montos llegan del backend como string decimal exacto ("1234.50"); se
// convierten a number solo para mostrar y graficar.

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
export const TZ = 'America/Argentina/Buenos_Aires';

export type Monto = string | null;

// Paleta acotada: color de marca, uno para la comparación y gris de contexto.
// Verde/rojo solo para variaciones.
export const COLORES = {
  principal: '#2c5c88', // brand-500 HEFA
  secundario: '#e0a43a', // período anterior / segundo canal
  contexto: '#cbd5e1',
  grilla: '#eef2f6',
  eje: '#94a3b8',
};
export type Endpoint = 'resumen' | 'ventas' | 'productos' | 'stock-inmovilizado' | 'vendedoras' | 'clientes' | 'ciclo';

export interface PuntoSerie {
  periodo: string;
  facturacion: Monto;
  cobrado?: Monto;
  ventas: number;
  unidades: number;
  por_canal?: Record<string, { facturacion: Monto; cobrado?: Monto; ventas: number; unidades: number }>;
}

export interface Kpis {
  facturacion: Monto;
  ventas: number;
  unidades: number;
  ticket_promedio: Monto;
  margen_bruto: Monto;
  margen_pct: string | null;
  facturacion_con_costo: Monto;
  costo: Monto;
  clientes_unicos: number;
  clientes_repiten: number;
  pct_clientes_repiten: string | null;
  ventas_sin_cliente: number;
  items_sin_costo: number;
  items_costo_actual: number;
  cobrado: Monto;
  pct_cobranza: string | null;
  pendiente_cobro: Monto;
  cobrado_en_periodo: Monto;
  dias_entrega_cobro: string | null;
  ventas_con_dias_entrega_cobro: number;
}

export interface ResumenData {
  filtros: { agrupar: 'dia' | 'semana' | 'mes' };
  periodo_anterior: { desde: string; hasta: string };
  kpis: Kpis;
  anterior: Kpis;
  variacion: Record<string, string | null>;
  serie: PuntoSerie[];
  serie_anterior: PuntoSerie[];
  advertencias: string[];
}

export interface VentasData {
  agrupar: 'dia' | 'semana' | 'mes';
  canales: { id: string; nombre: string }[];
  serie: PuntoSerie[];
  total: { facturacion: Monto; cobrado: Monto; pct_cobranza: string | null; ventas: number; unidades: number };
  advertencias: string[];
}

export interface ProductoRow {
  product_id: number;
  codigo_interno: string | null;
  sku: string | null;
  nombre: string;
  unidades: number;
  facturacion: Monto;
  costo: Monto;
  margen: Monto;
  margen_pct: string | null;
  costo_actual: boolean;
  items_sin_costo: number;
  stock: number;
  dias_cobertura: string | null;
  ultima_venta: string | null;
}

export interface ProductosData {
  total_productos: number;
  productos: ProductoRow[];
  items_manuales: { items: number; facturacion: Monto };
  items_sin_costo: number;
  advertencias: string[];
}

export interface StockItem {
  deposito_id: number | null;
  deposito: string;
  product_id: number;
  codigo_interno: string | null;
  nombre: string;
  stock: number;
  costo_unitario: Monto;
  costo_actual: boolean;
  valor_costo: Monto;
  ultima_venta: string | null;
  nunca_vendido: boolean;
  primera_compra: string | null;
  dias_sin_venta: number | null;
}

export interface StockData {
  total_valor_costo: Monto;
  por_deposito: { deposito_id: number | null; deposito: string; productos: number; unidades: number; valor_costo: Monto; productos_sin_costo: number }[];
  items: StockItem[];
  advertencias: string[];
}

export interface VendedoraRow {
  vendedora_id: number;
  nombre: string;
  ventas: number;
  unidades: number;
  facturacion: Monto;
  ticket_promedio: Monto;
  clientes_unicos: number;
  margen: Monto;
  margen_pct: string | null;
  items_sin_costo: number;
  cobrado: Monto;
  pct_cobranza: string | null;
  pendiente_cobro: Monto;
  dias_entrega_cobro: string | null;
}

export interface VendedorasData {
  vendedoras: VendedoraRow[];
  advertencias: string[];
}

export interface ClienteRow {
  nombre: string;
  localidad: string | null;
  ventas: number;
  unidades: number;
  facturacion: Monto;
  compras_totales: number;
  primera_compra: string | null;
  ultima_compra: string | null;
  dias_promedio_entre_compras: string | null;
  una_sola_compra: boolean;
  telefono?: string | null;
  email?: string | null;
}

export interface ClientesData {
  kpis: {
    clientes_unicos: number;
    clientes_repiten: number;
    pct_clientes_repiten: string | null;
    clientes_una_sola_compra: number;
    ventas_sin_cliente: number;
  };
  clientes: ClienteRow[];
  advertencias: string[];
}

export interface StatsDias {
  promedio: string | null;
  mediana: string | null;
  ventas: number;
}

export interface Antiguedad {
  total: Monto;
  ventas: number;
  antiguedad: { rango: string; monto: Monto; ventas: number }[];
}

export interface PendienteRow {
  venta_id: number;
  fecha_venta: string;
  cliente: string | null;
  vendedora_id: number;
  vendedora: string;
  total: Monto;
  cobrado: Monto;
  por_cobrar: Monto;
  por_entregar: Monto;
  primera_entrega: string | null;
  primera_entrega_fecha_real: boolean | null;
  dias_desde_entrega: number | null;
  dias_desde_venta: number;
}

export interface CicloData {
  filtros: { agrupar: 'dia' | 'semana' | 'mes' };
  fechas_reales_desde: string | null;
  tiempos: { venta_entrega: StatsDias; venta_cobro: StatsDias; entrega_cobro: StatsDias };
  distribucion_entrega_cobro: { rango: string; ventas: number; monto: Monto }[];
  cobradas_antes_de_entregar: number;
  cobranza: { facturacion: Monto; cobrado: Monto; pct_cobranza: string | null; pendiente: Monto };
  caja: { total: Monto; pagos: number; pagos_fecha_aproximada: number; serie: { periodo: string; cobrado: Monto }[] };
  por_cobrar: Antiguedad;
  por_entregar: Antiguedad;
  por_vendedora: {
    vendedora_id: number;
    nombre: string;
    ventas_periodo: number;
    dias_venta_entrega: string | null;
    dias_venta_cobro: string | null;
    dias_entrega_cobro: string | null;
    por_cobrar: Monto;
    por_entregar: Monto;
  }[];
  pendientes: PendienteRow[];
  advertencias: string[];
}

// ─── API ─────────────────────────────────────────────────────────────────

async function errorDe(res: Response): Promise<Error> {
  let msg = `Error ${res.status}`;
  try {
    const body = await res.json();
    msg = body.message || body.detail || msg;
    if (Array.isArray(msg)) msg = 'Parámetros inválidos';
  } catch {
    /* sin cuerpo JSON */
  }
  if (res.status === 401 || res.status === 403) msg = 'No tenés permiso para ver reportes';
  return new Error(String(msg));
}

function url(endpoint: Endpoint, params: URLSearchParams): string {
  const qs = params.toString();
  return `${API_URL}/admin/reportes/${endpoint}${qs ? `?${qs}` : ''}`;
}

export async function fetchReporte<T>(endpoint: Endpoint, params: URLSearchParams, apiKey: string): Promise<T> {
  const res = await fetch(url(endpoint, params), { headers: { 'X-Admin-API-Key': apiKey } });
  if (!res.ok) throw await errorDe(res);
  return res.json();
}

export async function descargarCsv(endpoint: Endpoint, params: URLSearchParams, apiKey: string): Promise<void> {
  const p = new URLSearchParams(params);
  p.set('formato', 'csv');
  const res = await fetch(url(endpoint, p), { headers: { 'X-Admin-API-Key': apiKey } });
  if (!res.ok) throw await errorDe(res);
  const blob = await res.blob();
  const dispo = res.headers.get('content-disposition') || '';
  const nombre = /filename="([^"]+)"/.exec(dispo)?.[1] || `reporte-${endpoint}.csv`;
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

// ─── formato es-AR ───────────────────────────────────────────────────────

export const num = (v: Monto | number | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const entero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const unDecimal = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 1 });

/** $ 1.234.567 */
export function ars(v: Monto | number | undefined): string {
  const n = num(v);
  if (n === null) return '—';
  const s = `$ ${entero.format(Math.abs(Math.round(n)))}`;
  return n < 0 ? `−${s}` : s;
}

/** $ 1,2 M · $ 350 k · $ 900 */
export function arsCorto(v: Monto | number | undefined): string {
  const n = num(v);
  if (n === null) return '—';
  const abs = Math.abs(n);
  let s: string;
  if (abs >= 1_000_000) s = `$ ${unDecimal.format(abs / 1_000_000)} M`;
  else if (abs >= 1_000) s = `$ ${entero.format(Math.round(abs / 1_000))} k`;
  else s = `$ ${entero.format(Math.round(abs))}`;
  return n < 0 ? `−${s}` : s;
}

export function cantidad(v: number | string | null | undefined): string {
  const n = num(v as Monto);
  return n === null ? '—' : entero.format(n);
}

export function dias(v: string | number | null | undefined): string {
  const n = num(v as Monto);
  return n === null ? '—' : `${unDecimal.format(n)} d`;
}

export function pct(v: string | number | null | undefined): string {
  const n = num(v as Monto);
  return n === null ? '—' : `${unDecimal.format(n)} %`;
}

/** 'AAAA-MM-DD' → 'dd/mm/aaaa' (sin pasar por Date para no correr el día). */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** Etiqueta corta para ejes: 'dd/mm' o 'mmm aa' para meses. */
export function etiquetaPeriodo(iso: string, agrupar: string): string {
  const [y, m, d] = iso.split('-');
  if (agrupar === 'mes') {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    return `${meses[Number(m) - 1]} ${y.slice(2)}`;
  }
  return `${d}/${m}`;
}

// ─── fechas y presets ────────────────────────────────────────────────────

export type Preset = 'hoy' | '7d' | '30d' | 'mes' | 'mes_anterior' | 'custom';

export const PRESETS: { id: Preset; label: string }[] = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'mes', label: 'Mes actual' },
  { id: 'mes_anterior', label: 'Mes anterior' },
  { id: 'custom', label: 'Personalizado' },
];

export function hoyAR(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

export function rangoPreset(preset: Preset): { desde: string; hasta: string } | null {
  const hoy = hoyAR();
  const [y, m] = hoy.split('-').map(Number);
  switch (preset) {
    case 'hoy':
      return { desde: hoy, hasta: hoy };
    case '7d':
      return { desde: sumarDias(hoy, -6), hasta: hoy };
    case '30d':
      return { desde: sumarDias(hoy, -29), hasta: hoy };
    case 'mes':
      return { desde: `${y}-${String(m).padStart(2, '0')}-01`, hasta: hoy };
    case 'mes_anterior': {
      const primeroActual = `${y}-${String(m).padStart(2, '0')}-01`;
      const hasta = sumarDias(primeroActual, -1);
      return { desde: `${hasta.slice(0, 7)}-01`, hasta };
    }
    default:
      return null;
  }
}
