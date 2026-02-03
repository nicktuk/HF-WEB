// Product Types

export interface ProductImage {
  id: number;
  url: string;
  alt_text?: string;
  is_primary: boolean;
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
  is_featured: boolean;
  is_immediate_delivery: boolean;
  is_check_stock: boolean;
  images: ProductImage[];
  source_url?: string;
}

export interface ProductAdmin extends ProductPublic {
  original_name: string;
  custom_name?: string;
  original_price?: number;
  markup_percentage: number;
  custom_price?: number;
  description?: string;
  sku?: string;
  enabled: boolean;
  is_featured: boolean;
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
}

// Category Types

export interface Category {
  id: number;
  name: string;
  is_active: boolean;
  display_order: number;
  product_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface CategoryCreateForm {
  name: string;
  is_active: boolean;
  display_order: number;
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
  markup_percentage?: number;
  custom_name?: string;
  custom_price?: number;
  display_order?: number;
  category?: string;
  description?: string;
  short_description?: string;
  brand?: string;
  sku?: string;
  image_urls?: string[];
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
  description?: string;
  short_description?: string;
  brand?: string;
  sku?: string;
  category?: string;
  image_urls: string[];
  enabled: boolean;
  is_featured: boolean;
  is_immediate_delivery: boolean;
  is_check_stock: boolean;
}
