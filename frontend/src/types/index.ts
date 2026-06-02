// Product Types

export interface ColorStockItem {
  color: string;
  quantity: number;
  deposit_id?: number | null;
  deposit_name?: string | null;
}

export interface ProductImage {
  id: number;
  url: string;
  alt_text?: string;
  is_primary: boolean;
  color?: string | null;
}

export interface ProductPublic {
  id: number;
  slug: string;
  name: string;
  price: number | null;
  currency: string;
  short_description?: string;
  brand?: string;
  category?: string;
  category_id?: number;
  subcategory?: string;
  is_featured: boolean;
  is_immediate_delivery: boolean;
  is_check_stock: boolean;
  is_best_seller: boolean;
  is_on_demand: boolean;
  publish_without_stock: boolean;
  installments_3: boolean;
  installment_price?: number | null;
  stock_low_threshold?: number | null;
  stock_qty?: number | null;
  video_url?: string | null;
  images: ProductImage[];
  color_stock?: ColorStockItem[];
  source_url?: string;
  updated_at?: string;
}

export interface ProductAdmin extends ProductPublic {
  original_name: string;
  custom_name?: string;
  original_price?: number;
  pending_original_price?: number;
  pending_price_detected_at?: string;
  markup_percentage: number;
  wholesale_markup_percentage?: number;
  custom_price?: number;
  custom_installment_price?: number;
  description?: string;
  sku?: string;
  min_purchase_qty?: number;
  kit_content?: string;
  enabled: boolean;
  is_featured: boolean;
  subcategory?: string;
  source_website_id: number;
  source_website_name?: string;
  last_scraped_at?: string;
  scrape_error_count: number;
  scrape_last_error?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Market intelligence
  market_avg_price?: number;
  market_min_price?: number;
  market_max_price?: number;
  market_sample_count: number;
  stock_qty?: number;
  is_published: boolean;
}

export interface PendingPriceChange {
  product_id: number;
  display_name: string;
  source_website_name?: string;
  original_price?: number;
  pending_original_price: number;
  detected_at?: string;
}

// Stock Types

export interface Deposit {
  id: number;
  name: string;
  is_active: boolean;
  seller?: string | null;
  created_at: string;
}

export interface DepositStockItem {
  deposit_id: number;
  deposit_name: string;
  quantity: number;
}

export interface StockPurchase {
  id: number;
  purchase_id?: number | null;
  product_id: number | null;
  product_name?: string;
  description?: string;
  code?: string;
  purchase_date: string;
  unit_price: number;
  quantity: number;
  total_amount: number;
  out_quantity: number;
  deposit_id?: number | null;
  deposit_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface StockSummaryItem {
  product_id: number;
  stock_qty: number;
  reserved_qty?: number;
  original_price?: number;
  reserved_sale_value?: number;
}

export interface StockPreviewRow {
  row_number: number;
  description?: string;
  code?: string;
  supplier?: string | null;
  derived_code?: boolean;
  purchase_date?: string | null;
  unit_price?: number | null;
  quantity?: number | null;
  total_amount?: number | null;
  product_id?: number | null;
  product_name?: string | null;
  status: 'ok' | 'duplicate' | 'error' | 'unmatched';
  errors: string[];
}

export interface StockPreviewResponse {
  rows: StockPreviewRow[];
  summary: {
    total: number;
    ok: number;
    duplicate: number;
    error: number;
    unmatched: number;
  };
}

// Category Types

export interface Category {
  id: number;
  name: string;
  is_active: boolean;
  display_order: number;
  color: string;
  show_in_menu: boolean;
  product_count: number;
  enabled_product_count: number;
  created_at?: string;
  updated_at?: string;
  show_in_carousel: boolean;
  carousel_title: string | null;
  carousel_subtitle: string | null;
  carousel_image_url: string | null;
  carousel_bg_color: string | null;
  carousel_text_color: string | null;
  carousel_font: string | null; // 'sans' | 'serif' | 'mono'
  carousel_filter_type: string | null;
  carousel_glow: boolean;
  carousel_glow_color: string | null;
}

export interface CategoryCreateForm {
  name: string;
  is_active: boolean;
  display_order: number;
  color: string;
  show_in_menu: boolean;
  show_in_carousel?: boolean;
  carousel_title?: string;
  carousel_subtitle?: string;
  carousel_image_url?: string;
  carousel_bg_color?: string;
  carousel_text_color?: string;
  carousel_font?: string;
  carousel_filter_type?: string | null;
  carousel_glow?: boolean;
  carousel_glow_color?: string;
}

export interface CategoryMapping {
  id: number;
  source_name: string;
  source_key: string;
  category_id: number;
  category_name: string;
  created_at?: string;
  updated_at?: string;
}

export interface UnmappedSourceCategory {
  source_name: string;
  product_count: number;
}

export interface SourceCategoryProduct {
  id: number;
  slug: string;
  name: string;
  enabled: boolean;
  source_category: string;
  source_website_name?: string;
  mapped_category_id?: number;
  mapped_category_name?: string;
}

// Subcategory Types

export interface Subcategory {
  id: number;
  name: string;
  category_id: number;
  category_name?: string;
  is_active: boolean;
  display_order: number;
  color: string;
  product_count: number;
  enabled_product_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface SubcategoryCreateForm {
  name: string;
  category_id: number;
  is_active: boolean;
  display_order: number;
  color: string;
}

export interface SubcategoryPublic {
  name: string;
  category_name: string;
  color: string;
}

// Source Website Types

export interface SourceWebsite {
  id: number;
  name: string;
  display_name: string;
  base_url: string;
  is_active: boolean;
  scraper_config?: Record<string, unknown>;
  notes?: string;
  product_count: number;
  enabled_product_count: number;
  created_at: string;
  updated_at: string;
}

// Market Price Types

export interface SourceBreakdown {
  source_name: string;
  source_display_name: string;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  count: number;
}

export interface MarketPriceStats {
  product_id: number;
  avg_price?: number;
  min_price?: number;
  max_price?: number;
  median_price?: number;
  sample_count: number;
  outlier_count: number;
  sources_count: number;
  breakdown_by_source: SourceBreakdown[];
  last_updated?: string;
}

export interface PriceComparison {
  product_id: number;
  product_name: string;
  your_price?: number;
  market_avg?: number;
  market_min?: number;
  market_max?: number;
  vs_avg_percentage?: number;
  vs_min_percentage?: number;
  vs_max_percentage?: number;
  competitiveness: 'competitive' | 'moderate' | 'high' | 'very_high' | 'below_market' | 'unknown';
  recommendation?: string;
}

// API Response Types

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface MessageResponse {
  message: string;
  success: boolean;
}

export interface ErrorResponse {
  error: string;
  message: string;
  detail?: string;
}

// Form Types

export interface ProductCreateForm {
  source_website_id: number;
  slug: string;
  markup_percentage: number;
  enabled: boolean;
  category?: string;
}

export interface ProductUpdateForm {
  enabled?: boolean;
  is_featured?: boolean;
  is_immediate_delivery?: boolean;
  is_check_stock?: boolean;
  is_on_demand?: boolean;
  is_best_seller?: boolean;
  is_published?: boolean;
  publish_without_stock?: boolean;
  installments_3?: boolean;
  custom_installment_price?: number | null;
  stock_low_threshold?: number | null;
  markup_percentage?: number;
  custom_name?: string;
  original_price?: number;
  custom_price?: number;
  display_order?: number;
  category?: string;
  category_id?: number;
  subcategory?: string;
  description?: string;
  short_description?: string;
  brand?: string;
  sku?: string;
  image_urls?: string[];
  image_colors?: (string | null)[];
  image_alt_texts?: (string | null)[];
  video_url?: string | null;
}

export interface SourceWebsiteCreateForm {
  name: string;
  display_name: string;
  base_url: string;
  is_active: boolean;
  notes?: string;
}

export interface ProductCreateManualForm {
  name: string;
  price: number;
  price_as_original?: boolean;
  description?: string;
  short_description?: string;
  brand?: string;
  sku?: string;
  category?: string;
  subcategory?: string;
  image_urls: string[];
  enabled: boolean;
  is_featured: boolean;
  is_immediate_delivery: boolean;
  is_check_stock: boolean;
  is_on_demand?: boolean;
}

// Sales Types

export interface SaleItemCreate {
  product_id?: number;
  product_name?: string;
  color?: string | null;
  quantity: number;
  unit_price: number;
  delivered?: boolean;
  paid?: boolean;
}

export interface SaleCreateForm {
  customer_name?: string;
  notes?: string;
  installments?: number;
  installment_amounts?: number[];
  seller: 'Facu' | 'Heber';
  items: SaleItemCreate[];
}

export interface SaleItem {
  id: number;
  product_id?: number;
  product_name?: string;
  color?: string | null;
  quantity: number;
  delivered_quantity: number;
  delivered: boolean;
  paid: boolean;
  unit_price: number;
  total_price: number;
}

export interface SaleInstallment {
  id: number;
  number: number;
  amount: number;
  paid: boolean;
  paid_at?: string;
}

export interface Sale {
  id: number;
  customer_name?: string;
  phone?: string | null;
  email?: string | null;
  notes?: string;
  installments?: number;
  seller: string;
  delivered: boolean;
  paid: boolean;
  payment_method?: string | null;
  total_amount: number;
  delivered_amount: number;
  paid_amount: number;
  items: SaleItem[];
  installment_list: SaleInstallment[];
  created_at?: string;
}

export interface PaymentMethodConfig {
  name: string;
  is_business: boolean;
  is_card: boolean;
  is_mercadopago: boolean;
}

export interface Expense {
  id: number;
  date: string;
  description: string;
  payment_method?: string | null;
  amount: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicOrderItem {
  product_id: number;
  quantity: number;
  color?: string | null;
  is_card_payment?: boolean;
}

export interface PublicOrderCreate {
  name: string;
  phone: string;
  email?: string;
  payment_method?: string;
  is_card_payment?: boolean;
  notes?: string;
  items: PublicOrderItem[];
}

export interface PublicOrderResponse {
  id: number;
  message: string;
}

export interface ExpenseCreateForm {
  date: string;
  description: string;
  payment_method?: string;
  amount: number;
  notes?: string;
}

export interface ExpenseListResponse {
  items: Expense[];
  total: number;
}

export interface CustomerRankingItem {
  customer_name: string;
  purchase_count: number;
  product_count: number;
  total_amount: number;
}

// Order Types

export interface OrderItem {
  id: number;
  description: string;
  quantity: number;
  estimated_price?: number | null;
}

export interface OrderAttachment {
  id: number;
  url: string;
  type: 'image' | 'link';
  label?: string | null;
}

export interface Order {
  id: number;
  customer_name: string;
  notes?: string | null;
  seller: string;
  status: 'active' | 'completed_sale' | 'completed_no_sale';
  linked_sale_id?: number | null;
  no_sale_reason?: string | null;
  items: OrderItem[];
  attachments: OrderAttachment[];
  created_at?: string;
  updated_at?: string;
}

export interface OrderItemCreate {
  description: string;
  quantity: number;
  estimated_price?: number | null;
}

export interface OrderAttachmentCreate {
  url: string;
  type: 'image' | 'link';
  label?: string;
}

export interface OrderCreateForm {
  customer_name: string;
  notes?: string;
  seller: string;
  items: OrderItemCreate[];
  attachments: OrderAttachmentCreate[];
}

export interface OrderClose {
  action: 'sale' | 'no_sale';
  linked_sale_id?: number;
  no_sale_reason?: string;
}

export interface OrderStats {
  active_count: number;
  completed_sale_count: number;
  completed_no_sale_count: number;
}

// WhatsApp Types

export interface WhatsAppProductItem {
  id: number;
  name: string;
  price: number | null;
  image_url: string | null;
  is_featured: boolean;
  is_immediate_delivery: boolean;
  is_best_seller: boolean;
  is_published: boolean;
  category: string | null;
  subcategory: string | null;
}

export interface WhatsAppMessage {
  text: string;
  image_url: string | null;
  product_id: number;
  product_name: string;
  wa_link: string | null;
}

export interface WhatsAppBulkMessage {
  text: string;
  images: Array<{
    product_id: number;
    product_name: string;
    image_url: string;
  }>;
  product_count: number;
}

// Section Types

export interface ProductInSection {
  id: number;
  slug: string;
  name: string;
  price: number | null;
  currency: string;
  brand?: string;
  category?: string;
  subcategory?: string;
  is_featured: boolean;
  is_immediate_delivery: boolean;
  is_check_stock: boolean;
  is_best_seller: boolean;
  images: { id: number; url: string; alt_text: string | null; is_primary: boolean }[];
}

export interface Section {
  id: number;
  title: string;
  subtitle: string | null;
  display_order: number;
  is_active: boolean;
  criteria_type: string;
  criteria_value: string | null;
  max_products: number;
  bg_color: string | null;
  text_color: string | null;
  image_url: string | null;
  position: 'arriba' | 'abajo';
  products: ProductInSection[];
}

// ─── Import Scorer ─────────────────────────────────────────────────────────────

export interface ISRubroTemplate {
  id: string;
  nombre: string;
  descripcion: string | null;
  retailers_recomendados: string[];
  outlets_recomendados: string[];
  margen_minimo_verde: number;
  margen_minimo_amarillo: number;
  top_n_scraping_default: number;
  dias_rotacion_esperada: number | null;
  flag_restriccion: string | null;
  palabras_clave_default: string[];
  blacklist_default: string[];
  created_at: string;
  updated_at: string;
}

export interface ISRubroTemplateCreate {
  nombre: string;
  descripcion?: string;
  retailers_recomendados?: string[];
  outlets_recomendados?: string[];
  margen_minimo_verde?: number;
  margen_minimo_amarillo?: number;
  top_n_scraping_default?: number;
  dias_rotacion_esperada?: number;
  flag_restriccion?: string;
  palabras_clave_default?: string[];
  blacklist_default?: string[];
}

export interface ISRetailer {
  id: string;
  nombre: string;
  slug: string;
  tipo: 'online' | 'ambos';
  base_url: string;
  search_url_template: string;
  scraper_implementacion: string;
  requiere_auth: boolean;
  cobra_tax_fl: boolean;
  envio_gratis_umbral: number | null;
  delay_min_ms: number;
  delay_max_ms: number;
  requiere_stealth: boolean;
  activo: boolean;
  pausado_hasta: string | null;
  ultimo_error: string | null;
  veces_usado: number;
  productos_comprados_total: number;
  margen_real_promedio: number | null;
  scraper_disponible: boolean;
  created_at: string;
  updated_at: string;
}

export interface ISRetailerCreate {
  nombre: string;
  slug: string;
  tipo?: 'online' | 'ambos';
  base_url: string;
  search_url_template: string;
  scraper_implementacion?: string;
  requiere_auth?: boolean;
  cobra_tax_fl?: boolean;
  envio_gratis_umbral?: number;
  delay_min_ms?: number;
  delay_max_ms?: number;
  requiere_stealth?: boolean;
  activo?: boolean;
}

export interface ISOutlet {
  id: string;
  nombre: string;
  tipo: 'tienda' | 'mall_outlet';
  ciudad: string;
  estado: string;
  direccion: string | null;
  rubros_tipicos: string[];
  activo: boolean;
  fee_agencia_usd: number;
  visitas_pasadas: number;
  efectividad_historica: number | null;
  notas_internas: string | null;
  created_at: string;
  updated_at: string;
}

export interface ISOutletCreate {
  nombre: string;
  tipo?: 'tienda' | 'mall_outlet';
  ciudad: string;
  estado: string;
  direccion?: string;
  rubros_tipicos?: string[];
  activo?: boolean;
  fee_agencia_usd?: number;
  notas_internas?: string;
}

export interface ISRubro {
  id: string;
  nombre: string;
  template_id: string | null;
  ml_category_id: string | null;
  ml_listado_url: string | null;
  top_n_scraping: number;
  filtro_vendidos_min: number | null;
  retailers_activos: string[];
  palabras_busqueda_usa: string[];
  palabras_busqueda_traducciones: Record<string, string> | null;
  marcas_whitelist: string[];
  blacklist_palabras: string[];
  peso_min_kg: number | null;
  peso_max_kg: number | null;
  margen_minimo_verde: number;
  margen_minimo_amarillo: number;
  dias_rotacion_esperada: number | null;
  outlets_activos: string[];
  es_estacional: boolean;
  meses_alta_demanda: number[];
  activo: boolean;
  prioridad: 'alta' | 'media' | 'baja';
  frecuencia_scraping: 'diaria' | 'semanal' | 'manual';
  flag_restriccion: string | null;
  notas_internas: string | null;
  total_productos: number;
  created_at: string;
  updated_at: string;
}

export interface ISRubroCreate {
  nombre: string;
  template_id?: string | null;
  ml_category_id?: string | null;
  ml_listado_url?: string | null;
  top_n_scraping?: number;
  filtro_vendidos_min?: number;
  retailers_activos?: string[];
  palabras_busqueda_usa?: string[];
  marcas_whitelist?: string[];
  blacklist_palabras?: string[];
  peso_min_kg?: number;
  peso_max_kg?: number;
  margen_minimo_verde?: number;
  margen_minimo_amarillo?: number;
  dias_rotacion_esperada?: number;
  outlets_activos?: string[];
  es_estacional?: boolean;
  meses_alta_demanda?: number[];
  activo?: boolean;
  prioridad?: 'alta' | 'media' | 'baja';
  frecuencia_scraping?: 'diaria' | 'semanal' | 'manual';
  flag_restriccion?: string;
  notas_internas?: string;
}

export interface ISMepRate {
  cotizacion: number;
  fuente: string;
  timestamp: string;
}

export interface ISTrendSnapshot {
  rubro_id: string;
  rubro_nombre: string;
  keyword: string | null;
  data_ar: number[];
  data_usa: number[];
  score_ar: number | null;
  score_usa: number | null;
  tendencia_ar: 'subiendo' | 'bajando' | 'estable' | 'sin_datos';
  tendencia_usa: 'subiendo' | 'bajando' | 'estable' | 'sin_datos';
  updated_at: string | null;
}

export interface ISConfig {
  id: string;
  costo_flete_usd_por_kg: number;
  sales_tax_fl: number;
  margen_minimo_verde_global: number;
  margen_minimo_amarillo_global: number;
  fee_agencia_compra_fisica: number;
  umbral_lista_caza_usd: number;
  peso_minimo_envio: number;
  peso_optimo_envio: number;
  peso_maximo_envio: number;
  capital_maximo_envio: number;
}

export interface ISOferta {
  id: string;
  retailer_id: string;
  retailer_nombre: string | null;
  precio_usd: number;
  url: string;
  en_clearance: boolean;
  en_stock: boolean;
  envio_gratis: boolean;
  fecha: string;
}

export interface ISProducto {
  id: string;
  nombre: string;
  marca: string | null;
  modelo: string | null;
  rubro_id: string;
  rubro_nombre: string | null;
  imagen_url: string | null;
  ml_url: string | null;
  ml_precio_ars: number | null;
  ml_vendidos: number | null;
  ml_posicion_ranking: number | null;
  mejor_retailer_id: string | null;
  mejor_retailer_nombre: string | null;
  mejor_precio_usd: number | null;
  mejor_precio_url: string | null;
  peso_kg: number | null;
  sales_tax_usd: number | null;
  costo_flete_usd: number | null;
  costo_puesto_usd: number | null;
  precio_venta_usd: number | null;
  ratio_margen: number | null;
  semaforo: 'verde' | 'amarillo' | 'rojo' | null;
  modo_caza: boolean;
  precio_objetivo_usd: number | null;
  cantidad_sugerida: number | null;
  score_online: number | null;
  score_caza: number | null;
  flag_restriccion: string | null;
  pinned: boolean;
  descartado: boolean;
  veces_importado: number;
  total_unidades_importadas: number;
  total_unidades_vendidas: number;
  dias_promedio_venta: number | null;
  margen_real_promedio: number | null;
  notas_manual: string | null;
  ofertas: ISOferta[];
  updated_at: string;
}

export interface ISProductoUpdate {
  peso_kg?: number;
  precio_objetivo_usd?: number;
  cantidad_sugerida?: number;
  modo_caza?: boolean;
  pinned?: boolean;
  descartado?: boolean;
  notas_manual?: string;
}

export interface ISCarritoItem {
  id: string;
  carrito_id: string;
  producto_id: string;
  producto_nombre: string | null;
  producto_imagen_url: string | null;
  retailer_id: string | null;
  retailer_nombre: string | null;
  precio_usd_locked: number;
  peso_kg_locked: number;
  cantidad: number;
  en_clearance_at_add: boolean;
  modo_compra: 'online' | 'outlet';
  outlet_esperado_id: string | null;
  comprado: boolean;
  fecha_compra: string | null;
  precio_real_usd: number | null;
  unidades_recibidas: number;
  unidades_vendidas: number;
  precio_venta_promedio_ars: number | null;
  margen_real_ratio: number | null;
  notas: string | null;
}

export interface ISCarritoItemCreate {
  producto_id: string;
  retailer_id?: string;
  precio_usd_locked: number;
  peso_kg_locked: number;
  cantidad?: number;
  en_clearance_at_add?: boolean;
  modo_compra?: 'online' | 'outlet';
  outlet_esperado_id?: string;
}

export interface ISCarrito {
  id: string;
  nombre: string;
  estado: 'borrador' | 'cotizado' | 'comprado' | 'en_transito' | 'recibido' | 'cancelado';
  notas: string | null;
  cotizacion_mep_snapshot: number | null;
  fecha_cotizacion: string | null;
  fecha_compra: string | null;
  fecha_arribo: string | null;
  costo_total_real_usd: number | null;
  costo_flete_real_usd: number | null;
  fee_agencia_usd: number | null;
  peso_real_kg: number | null;
  es_plantilla: boolean;
  items: ISCarritoItem[];
  total_items: number;
  resumen: Record<string, unknown> | null;
  alertas: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

export interface ISCarritoCreate {
  nombre: string;
  notas?: string;
  es_plantilla?: boolean;
}

export interface ISListaCaza {
  id: string;
  fecha: string;
  carrito_origen_id: string | null;
  estado: string;
  productos: Array<Record<string, unknown>>;
  total_estimado_usd: number;
  outlets_recomendados_ids: string[];
  fee_agencia_usd: number | null;
  notas_agencia: string | null;
  resultados_agencia: Record<string, unknown> | null;
}

export interface ISListaCazaCreate {
  carrito_origen_id?: string;
  productos?: Array<Record<string, unknown>>;
  total_estimado_usd?: number;
  outlets_recomendados_ids?: string[];
  fee_agencia_usd?: number;
  notas_agencia?: string;
}
