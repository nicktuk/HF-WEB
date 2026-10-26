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
  sale_price?: number | null;
  is_on_sale: boolean;
  discount_percentage?: number | null;
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
  updated_at?: string;
  activated_at?: string | null;
  rating_avg?: number | null;
  rating_count?: number;
  units_sold?: number;
  reviews?: ProductReview[];
}

export interface ProductReview {
  id: number;
  rating: number;
  reviewer_name: string;
  comment?: string | null;
  created_at: string;
}

export interface ProductAdmin extends ProductPublic {
  original_name: string;
  custom_name?: string;
  display_name_with_code: string;
  original_price?: number;
  markup_percentage: number;
  wholesale_markup_percentage?: number;
  custom_price?: number;
  sale_price?: number | null;
  sale_price_ends_at?: string | null;
  custom_installment_price?: number;
  description?: string;
  sku?: string;
  codigo_interno?: string | null;
  mostrar_codigo: boolean;
  min_purchase_qty?: number;
  kit_content?: string;
  enabled: boolean;
  is_featured: boolean;
  subcategory?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  stock_qty?: number;
  is_published: boolean;
  alias_bot?: string | null;
}

export interface ProductComercioImage {
  id: number;
  url: string;
  alt_text?: string | null;
}

export interface ComercioIconItem {
  icon: string;
  label: string;
}

export interface ProductComercioConfig {
  product_id: number;
  es_mayorista: boolean;
  precio_mayorista?: number | null;
  unidades_por_bulto?: number | null;
  cantidad_minima?: number | null;
  descripcion?: string | null;
  iconos?: ComercioIconItem[] | null;
  images: ProductComercioImage[];
}

export interface ProductComercioConfigUpdateForm {
  es_mayorista?: boolean;
  precio_mayorista?: number | null;
  unidades_por_bulto?: number | null;
  cantidad_minima?: number | null;
  descripcion?: string | null;
  iconos?: ComercioIconItem[] | null;
  image_urls?: string[];
  image_alt_texts?: (string | null)[];
}

// Stock Types

export interface Deposit {
  id: number;
  name: string;
  is_active: boolean;
  seller_id?: number | null;
  seller_nombre?: string | null;
  created_at: string;
}

export interface CodigoAmba {
  id: number;
  codigo_desde: number;
  codigo_hasta: number;
}

export interface CatalogSeller {
  id: number;
  nombre: string;
  celular: string | null;
  activo: boolean;
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
  original_price?: number | null;
  custom_price?: number | null;
  sale_price?: number | null;
  sale_price_ends_at?: string | null;
  display_order?: number;
  category?: string;
  category_id?: number;
  subcategory?: string;
  description?: string;
  short_description?: string;
  brand?: string;
  sku?: string;
  mostrar_codigo?: boolean;
  image_urls?: string[];
  image_colors?: (string | null)[];
  image_alt_texts?: (string | null)[];
  video_url?: string | null;
  alias_bot?: string | null;
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
  seller_id: number;
  items: SaleItemCreate[];
  comision_porcentaje?: number;
  comision_monto?: number;
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
  delivered_at?: string | null;
  paid_at?: string | null;
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
  seller_id: number;
  seller_nombre: string;
  origen: string;
  // Venta generada desde un pedido de comercio (origen 'mayorista'): se
  // modifica desde el pedido, no desde Ventas.
  pedido_mayorista_id?: number | null;
  delivered: boolean;
  paid: boolean;
  payment_method?: string | null;
  delivery_method?: string | null;
  shipping_zone?: string | null;
  shipping_street?: string | null;
  shipping_floor_apt?: string | null;
  shipping_city?: string | null;
  shipping_province?: string | null;
  shipping_postal_code?: string | null;
  shipping_reference?: string | null;
  total_amount: number;
  delivered_amount: number;
  paid_amount: number;
  items: SaleItem[];
  installment_list: SaleInstallment[];
  created_at?: string;
  comision_porcentaje_manual?: number | null;
  comision_monto_manual?: number | null;
  comision_tasa?: number | null;
  comision_monto?: number | null;
  comision_estado?: string | null;
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

export type DeliveryMethod = 'pickup' | 'shipping' | 'agreement';
export type ShippingZone = 'amba' | 'resto_pais';

export interface PublicOrderCreate {
  name: string;
  phone: string;
  email: string;
  payment_method?: string;
  is_card_payment?: boolean;
  notes?: string;
  delivery_method?: DeliveryMethod;
  shipping_street?: string;
  shipping_floor_apt?: string;
  shipping_city?: string;
  shipping_province?: string;
  shipping_postal_code?: string;
  shipping_reference?: string;
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
  seller_id: number;
  seller_nombre: string;
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
  seller_id: number;
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
