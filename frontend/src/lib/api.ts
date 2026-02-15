import type {
  ProductPublic,
  ProductAdmin,
  SourceWebsite,
  MarketPriceStats,
  PriceComparison,
  PaginatedResponse,
  MessageResponse,
  ProductCreateForm,
  ProductCreateManualForm,
  ProductUpdateForm,
  SourceWebsiteCreateForm,
  StockPurchase,
  StockPreviewResponse,
  StockSummaryItem,
  PendingPriceChange,
  SaleCreateForm,
  Sale,
  WhatsAppProductItem,
  WhatsAppMessage,
  WhatsAppBulkMessage,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

/**
 * Base fetch wrapper with error handling
 */
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {},
  apiKey?: string
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (apiKey) {
    headers['X-Admin-API-Key'] = apiKey;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
    throw new Error(error.message || `HTTP error ${response.status}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// ============================================
// Public API (no auth required)
// ============================================

export const publicApi = {
  /**
   * Get public product catalog
   */
  async getProducts(params: {
    page?: number;
    limit?: number;
    category?: string;
    subcategory?: string;
    search?: string;
    featured?: boolean;
    immediate_delivery?: boolean;
  } = {}): Promise<PaginatedResponse<ProductPublic>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.category) searchParams.set('category', params.category);
    if (params.subcategory) searchParams.set('subcategory', params.subcategory);
    if (params.search) searchParams.set('search', params.search);
    if (params.featured !== undefined) searchParams.set('featured', params.featured.toString());
    if (params.immediate_delivery !== undefined) {
      searchParams.set('immediate_delivery', params.immediate_delivery.toString());
    }

    const query = searchParams.toString();
    return fetchAPI(`/public/products${query ? `?${query}` : ''}`);
  },

  /**
   * Get single product by slug
   */
  async getProduct(slug: string): Promise<ProductPublic> {
    return fetchAPI(`/public/products/${slug}`);
  },

  /**
   * Get list of categories
   */
  async getCategories(): Promise<{ name: string; color: string; show_in_menu: boolean; display_order: number }[]> {
    return fetchAPI('/public/categories');
  },

  /**
   * Get list of subcategories
   */
  async getSubcategories(category?: string): Promise<{ name: string; category_name: string; color: string }[]> {
    const params = category ? `?category=${encodeURIComponent(category)}` : '';
    return fetchAPI(`/public/subcategories${params}`);
  },
};

// ============================================
// Admin API (auth required)
// ============================================

export const adminApi = {
  /**
   * Get all products for admin
   */
  async getProducts(
    apiKey: string,
    params: {
      page?: number;
      limit?: number;
      enabled?: boolean;
      source_website_id?: number;
      search?: string;
      category_id?: number;
      category?: string;
      without_category?: boolean;
      subcategory?: string;
      is_featured?: boolean;
      is_immediate_delivery?: boolean;
      in_stock?: boolean;
      price_range?: string;
    } = {}
  ): Promise<PaginatedResponse<ProductAdmin>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.enabled !== undefined) searchParams.set('enabled', params.enabled.toString());
    if (params.source_website_id) searchParams.set('source_website_id', params.source_website_id.toString());
    if (params.search) searchParams.set('search', params.search);
    if (params.category_id !== undefined) searchParams.set('category_id', params.category_id.toString());
    if (params.without_category !== undefined) searchParams.set('without_category', params.without_category.toString());
    if (params.category) searchParams.set('category', params.category);
    if (params.subcategory) searchParams.set('subcategory', params.subcategory);
    if (params.is_featured !== undefined) searchParams.set('is_featured', params.is_featured.toString());
    if (params.is_immediate_delivery !== undefined) {
      searchParams.set('is_immediate_delivery', params.is_immediate_delivery.toString());
    }
    if (params.in_stock !== undefined) {
      searchParams.set('in_stock', params.in_stock.toString());
    }
    if (params.price_range) searchParams.set('price_range', params.price_range);

    const query = searchParams.toString();
    return fetchAPI(`/admin/products${query ? `?${query}` : ''}`, {}, apiKey);
  },

  /**
   * Get pending original price changes
   */
  async getPendingPriceChanges(apiKey: string): Promise<{ items: PendingPriceChange[] }> {
    return fetchAPI('/admin/products/pending-prices', {}, apiKey);
  },

  /**
   * Approve pending original price changes
   */
  async approvePendingPriceChanges(apiKey: string, productIds: number[]): Promise<MessageResponse> {
    return fetchAPI('/admin/products/pending-prices/approve', {
      method: 'POST',
      body: JSON.stringify({ product_ids: productIds }),
    }, apiKey);
  },

  /**
   * Reject pending original price changes
   */
  async rejectPendingPriceChanges(apiKey: string, productIds: number[]): Promise<MessageResponse> {
    return fetchAPI('/admin/products/pending-prices/reject', {
      method: 'POST',
      body: JSON.stringify({ product_ids: productIds }),
    }, apiKey);
  },

  /**
   * Get single product by ID
   */
  async getProduct(apiKey: string, id: number): Promise<ProductAdmin> {
    return fetchAPI(`/admin/products/${id}`, {}, apiKey);
  },

  /**
   * Create product by scraping
   */
  async createProduct(apiKey: string, data: ProductCreateForm): Promise<ProductAdmin> {
    return fetchAPI('/admin/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }, apiKey);
  },

  /**
   * Create product manually (without scraping)
   */
  async createProductManual(apiKey: string, data: ProductCreateManualForm): Promise<ProductAdmin> {
    return fetchAPI('/admin/products/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    }, apiKey);
  },

  /**
   * Update product
   */
  async updateProduct(apiKey: string, id: number, data: ProductUpdateForm): Promise<ProductAdmin> {
    return fetchAPI(`/admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, apiKey);
  },

  /**
   * Delete product
   */
  async deleteProduct(apiKey: string, id: number): Promise<void> {
    return fetchAPI(`/admin/products/${id}`, {
      method: 'DELETE',
    }, apiKey);
  },

  /**
   * Re-scrape product
   */
  async rescrapeProduct(apiKey: string, id: number): Promise<MessageResponse> {
    return fetchAPI(`/admin/products/${id}/rescrape`, {
      method: 'POST',
    }, apiKey);
  },

  /**
   * Bulk action on products
   */
  async bulkAction(
    apiKey: string,
    productIds: number[],
    action: 'enable' | 'disable' | 'delete'
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/bulk-action', {
      method: 'POST',
      body: JSON.stringify({ product_ids: productIds, action }),
    }, apiKey);
  },

  /**
   * Set markup percentage for all products
   */
  async bulkSetMarkup(
    apiKey: string,
    markupPercentage: number,
    onlyEnabled: boolean = true,
    sourceWebsiteId?: number
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/bulk-markup', {
      method: 'POST',
      body: JSON.stringify({
        markup_percentage: markupPercentage,
        only_enabled: onlyEnabled,
        source_website_id: sourceWebsiteId,
      }),
    }, apiKey);
  },

  /**
   * Set wholesale markup percentage for products
   */
  async bulkSetWholesaleMarkup(
    apiKey: string,
    markupPercentage: number,
    onlyEnabled: boolean = false,
    sourceWebsiteId?: number
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/bulk-wholesale-markup', {
      method: 'POST',
      body: JSON.stringify({
        markup_percentage: markupPercentage,
        only_enabled: onlyEnabled,
        source_website_id: sourceWebsiteId,
      }),
    }, apiKey);
  },

  /**
   * Activate all inactive products with markup
   */
  async activateAllInactive(
    apiKey: string,
    markupPercentage: number
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/activate-all-inactive', {
      method: 'POST',
      body: JSON.stringify({
        markup_percentage: markupPercentage,
      }),
    }, apiKey);
  },

  /**
   * Activate selected products with markup
   */
  async activateSelected(
    apiKey: string,
    productIds: number[],
    markupPercentage: number,
    category?: string,
    subcategory?: string
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/activate-selected', {
      method: 'POST',
      body: JSON.stringify({
        product_ids: productIds,
        markup_percentage: markupPercentage,
        category: category || null,
        subcategory: subcategory || null,
      }),
    }, apiKey);
  },

  /**
   * Change category for selected products
   */
  async changeCategorySelected(
    apiKey: string,
    productIds: number[],
    category: string
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/change-category-selected', {
      method: 'POST',
      body: JSON.stringify({
        product_ids: productIds,
        category: category,
      }),
    }, apiKey);
  },

  /**
   * Disable selected products
   */
  async disableSelected(
    apiKey: string,
    productIds: number[]
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/disable-selected', {
      method: 'POST',
      body: JSON.stringify({
        product_ids: productIds,
      }),
    }, apiKey);
  },

  /**
   * Change subcategory for selected products
   */
  async changeSubcategorySelected(
    apiKey: string,
    productIds: number[],
    subcategory: string
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/change-subcategory-selected', {
      method: 'POST',
      body: JSON.stringify({
        product_ids: productIds,
        subcategory: subcategory,
      }),
    }, apiKey);
  },

  /**
   * Get market price stats
   */
  async getMarketPrices(apiKey: string, productId: number): Promise<MarketPriceStats> {
    return fetchAPI(`/admin/products/${productId}/market-prices`, {}, apiKey);
  },

  /**
   * Refresh market prices
   */
  async refreshMarketPrices(
    apiKey: string,
    productId: number,
    options: { force?: boolean; search_query?: string } = {}
  ): Promise<MarketPriceStats> {
    return fetchAPI(`/admin/products/${productId}/market-prices/refresh`, {
      method: 'POST',
      body: JSON.stringify(options),
    }, apiKey);
  },

  /**
   * Get price comparison
   */
  async getPriceComparison(apiKey: string, productId: number): Promise<PriceComparison> {
    return fetchAPI(`/admin/products/${productId}/price-comparison`, {}, apiKey);
  },

  // Source Websites

  /**
   * Get all source websites
   */
  async getSourceWebsites(apiKey: string): Promise<{ items: SourceWebsite[]; total: number }> {
    return fetchAPI('/admin/source-websites', {}, apiKey);
  },

  /**
   * Get single source website
   */
  async getSourceWebsite(apiKey: string, id: number): Promise<SourceWebsite> {
    return fetchAPI(`/admin/source-websites/${id}`, {}, apiKey);
  },

  /**
   * Create source website
   */
  async createSourceWebsite(apiKey: string, data: SourceWebsiteCreateForm): Promise<SourceWebsite> {
    return fetchAPI('/admin/source-websites', {
      method: 'POST',
      body: JSON.stringify(data),
    }, apiKey);
  },

  /**
   * Update source website
   */
  async updateSourceWebsite(
    apiKey: string,
    id: number,
    data: Partial<SourceWebsiteCreateForm>
  ): Promise<SourceWebsite> {
    return fetchAPI(`/admin/source-websites/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, apiKey);
  },

  /**
   * Delete source website
   */
  async deleteSourceWebsite(apiKey: string, id: number): Promise<void> {
    return fetchAPI(`/admin/source-websites/${id}`, {
      method: 'DELETE',
    }, apiKey);
  },

  /**
   * Scrape all products from a source website
   */
  async scrapeAllProducts(
    apiKey: string,
    sourceId: number,
    updateExisting: boolean = true
  ): Promise<MessageResponse> {
    const params = new URLSearchParams();
    params.set('update_existing', updateExisting.toString());
    return fetchAPI(`/admin/source-websites/${sourceId}/scrape-all?${params}`, {
      method: 'POST',
    }, apiKey);
  },

  /**
   * Export products to PDF
   * Returns the PDF file URL for download
   */
  getExportPdfUrl(apiKey: string, format: 'catalog' | 'list' = 'catalog'): string {
    return `${API_URL}/admin/products/export/pdf?format=${format}`;
  },

  /**
   * Download PDF export
   */
  async downloadPdf(apiKey: string, format: 'catalog' | 'list' = 'catalog'): Promise<Blob> {
    const url = `${API_URL}/admin/products/export/pdf?format=${format}`;
    const response = await fetch(url, {
      headers: {
        'X-Admin-API-Key': apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al generar PDF' }));
      throw new Error(error.detail || error.message || 'Error al generar PDF');
    }

    return response.blob();
  },

  /**
   * Export selected products with wholesale price
   */
  async exportWholesaleSelected(apiKey: string, productIds: number[]): Promise<Blob> {
    const response = await fetch(`${API_URL}/admin/products/export/wholesale`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': apiKey,
      },
      body: JSON.stringify({ product_ids: productIds }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al exportar mayorista' }));
      throw new Error(error.detail || error.message || 'Error al exportar mayorista');
    }

    return response.blob();
  },

  /**
   * Import stock purchases from CSV
   */
  async importStockCsv(apiKey: string, file: File): Promise<{ created: number; skipped: number; errors: string[]; touched_products: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/admin/stock/import`, {
      method: 'POST',
      headers: {
        'X-Admin-API-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al importar stock' }));
      throw new Error(error.detail || error.message || 'Error al importar stock');
    }

    return response.json();
  },

  /**
   * Preview stock purchases from CSV
   */
  async previewStockCsv(apiKey: string, file: File): Promise<StockPreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/admin/stock/preview`, {
      method: 'POST',
      headers: {
        'X-Admin-API-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al previsualizar stock' }));
      throw new Error(error.detail || error.message || 'Error al previsualizar stock');
    }

    return response.json();
  },

  /**
   * Get stock purchases (optionally by product)
   */
  async getStockPurchases(apiKey: string, productId?: number, unmatched?: boolean): Promise<StockPurchase[]> {
    const params = new URLSearchParams();
    if (productId) params.set('product_id', productId.toString());
    if (unmatched !== undefined) params.set('unmatched', unmatched.toString());
    const query = params.toString();
    return fetchAPI(`/admin/stock/purchases${query ? `?${query}` : ''}`, {}, apiKey);
  },

  /**
   * Get stock summary for product IDs
   */
  async getStockSummary(apiKey: string, productIds: number[]): Promise<{ items: StockSummaryItem[] }> {
    return fetchAPI('/admin/stock/summary', {
      method: 'POST',
      body: JSON.stringify({ product_ids: productIds }),
    }, apiKey);
  },

  /**
   * Update stock purchase (associate to product)
   */
  async updateStockPurchase(apiKey: string, purchaseId: number, productId: number | null): Promise<StockPurchase> {
    const response = await fetch(`${API_URL}/admin/stock/purchases/${purchaseId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-API-Key': apiKey,
      },
      body: JSON.stringify({ product_id: productId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al actualizar compra' }));
      const err = new Error(error.message || `HTTP error ${response.status}`);
      (err as any).detail = error;
      throw err;
    }

    return response.json();
  },

  /**
   * Create sale
   */
  async createSale(apiKey: string, data: SaleCreateForm): Promise<Sale> {
    return fetchAPI('/admin/sales', {
      method: 'POST',
      body: JSON.stringify(data),
    }, apiKey);
  },

  /**
   * List sales
   */
  async listSales(apiKey: string, limit: number = 50, search?: string): Promise<Sale[]> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (search) params.append('search', search);
    return fetchAPI(`/admin/sales?${params.toString()}`, {}, apiKey);
  },

  /**
   * Get sale by id
   */
  async getSale(apiKey: string, saleId: number): Promise<Sale> {
    return fetchAPI(`/admin/sales/${saleId}`, {}, apiKey);
  },

  /**
   * Update sale status
   */
  async updateSale(
    apiKey: string,
    saleId: number,
    data: {
      delivered?: boolean;
      paid?: boolean;
      customer_name?: string;
      notes?: string;
      installments?: number;
      seller?: 'Facu' | 'Heber';
      items?: Array<{ product_id?: number; product_name?: string; quantity: number; unit_price: number; delivered?: boolean; paid?: boolean }>;
    }
  ): Promise<Sale> {
    return fetchAPI(`/admin/sales/${saleId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }, apiKey);
  },

  /**
   * Delete sale
   */
  async deleteSale(apiKey: string, saleId: number): Promise<MessageResponse> {
    return fetchAPI(`/admin/sales/${saleId}`, {
      method: 'DELETE',
    }, apiKey);
  },

  /**
   * Rebuild stock deductions from delivered sale units
   */
  async reconcileDeliveredStock(apiKey: string): Promise<{
    sales_processed: number;
    units_requested: number;
    units_deducted: number;
    shortages: string[];
  }> {
    return fetchAPI('/admin/sales/reconcile-delivered-stock', {
      method: 'POST',
    }, apiKey);
  },

  // Badge Management

  /**
   * Remove badge from products
   */
  async removeBadgeBulk(
    apiKey: string,
    badge: 'is_featured' | 'is_immediate_delivery' | 'is_best_seller',
    productIds?: number[]
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/remove-badge', {
      method: 'POST',
      body: JSON.stringify({
        badge,
        product_ids: productIds || null,
      }),
    }, apiKey);
  },

  /**
   * Calculate and mark best sellers based on sales
   */
  async calculateBestSellers(apiKey: string, threshold: number = 5): Promise<MessageResponse> {
    return fetchAPI(`/admin/products/calculate-best-sellers?threshold=${threshold}`, {
      method: 'POST',
    }, apiKey);
  },

  /**
   * Mark products scraped on a specific date as "Nuevo"
   */
  async markNewByDate(apiKey: string, scrapeDate: string): Promise<MessageResponse> {
    return fetchAPI(`/admin/products/mark-new-by-date?scrape_date=${scrapeDate}`, {
      method: 'POST',
    }, apiKey);
  },

  // ============================================
  // Purchases with Payments
  // ============================================

  /**
   * Get all purchases with filters and pagination
   */
  async getPurchases(
    apiKey: string,
    params: {
      page?: number;
      limit?: number;
      supplier?: string;
      date_from?: string;
      date_to?: string;
      product_id?: number;
    } = {}
  ): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    pages: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.supplier) searchParams.set('supplier', params.supplier);
    if (params.date_from) searchParams.set('date_from', params.date_from);
    if (params.date_to) searchParams.set('date_to', params.date_to);
    if (params.product_id) searchParams.set('product_id', params.product_id.toString());

    const query = searchParams.toString();
    return fetchAPI(`/admin/purchases${query ? `?${query}` : ''}`, {}, apiKey);
  },

  /**
   * Get unique list of suppliers
   */
  async getSuppliers(apiKey: string): Promise<{ suppliers: string[] }> {
    return fetchAPI('/admin/purchases/suppliers', {}, apiKey);
  },

  /**
   * Get purchase detail with items and payments
   */
  async getPurchaseDetail(apiKey: string, purchaseId: number): Promise<any> {
    return fetchAPI(`/admin/purchases/${purchaseId}`, {}, apiKey);
  },

  /**
   * Add payment to a purchase
   */
  async addPaymentToPurchase(
    apiKey: string,
    purchaseId: number,
    payment: { payer: 'Facu' | 'Heber'; amount: number; payment_method: string }
  ): Promise<any> {
    return fetchAPI(`/admin/purchases/${purchaseId}/payments`, {
      method: 'POST',
      body: JSON.stringify({ payments: [payment] }),
    }, apiKey);
  },

  /**
   * Delete a payment from a purchase
   */
  async deletePayment(apiKey: string, purchaseId: number, paymentId: number): Promise<MessageResponse> {
    return fetchAPI(`/admin/purchases/${purchaseId}/payments/${paymentId}`, {
      method: 'DELETE',
    }, apiKey);
  },

  /**
   * Get purchases grouped by payer for dashboard
   */
  async getPurchasesByPayer(apiKey: string): Promise<{
    by_payer: Array<{ payer: string; total_amount: number; payment_count: number }>;
    without_payment: number;
  }> {
    return fetchAPI('/admin/stats/purchases-by-payer', {}, apiKey);
  },

  /**
   * Import stock CSV (supplier is read from CSV row column)
   */
  async importStockCsvWithSupplier(
    apiKey: string,
    file: File
  ): Promise<{ purchase_id: number; created: number; skipped: number; errors: string[]; touched_products: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/admin/stock/import`, {
      method: 'POST',
      headers: {
        'X-Admin-API-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error al importar stock' }));
      throw new Error(error.detail || error.message || 'Error al importar stock');
    }

    return response.json();
  },

  // WhatsApp Message Generator

  /**
   * Filter products for WhatsApp message generation
   */
  async filterProductsForWhatsApp(
    apiKey: string,
    filters: {
      is_featured?: boolean;
      is_immediate_delivery?: boolean;
      is_best_seller?: boolean;
      category?: string;
      subcategory?: string;
      limit?: number;
    }
  ): Promise<WhatsAppProductItem[]> {
    return fetchAPI('/admin/whatsapp/filter-products', {
      method: 'POST',
      body: JSON.stringify(filters),
    }, apiKey);
  },

  /**
   * Generate WhatsApp messages for selected products
   */
  async generateWhatsAppMessages(
    apiKey: string,
    data: {
      product_ids: number[];
      template?: 'default' | 'promo' | 'nuevos' | 'mas_vendidos' | 'custom';
      include_price?: boolean;
      custom_text?: string;
    }
  ): Promise<WhatsAppMessage[]> {
    return fetchAPI('/admin/whatsapp/generate-messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }, apiKey);
  },

  /**
   * Generate a single combined WhatsApp message for multiple products
   */
  async generateWhatsAppBulkMessage(
    apiKey: string,
    data: {
      product_ids: number[];
      template?: 'default' | 'promo' | 'nuevos' | 'mas_vendidos' | 'custom';
      include_price?: boolean;
      custom_text?: string;
    }
  ): Promise<WhatsAppBulkMessage> {
    return fetchAPI('/admin/whatsapp/generate-bulk-message', {
      method: 'POST',
      body: JSON.stringify(data),
    }, apiKey);
  },
};

/**
 * Upload images to the server
 * Returns array of full URLs for the uploaded images
 */
export async function uploadImages(apiKey: string, files: File[]): Promise<string[]> {
  const formData = new FormData();
  files.forEach(file => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_URL}/admin/upload/images`, {
    method: 'POST',
    headers: {
      'X-Admin-API-Key': apiKey,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Error al subir imagenes' }));
    throw new Error(error.detail || error.message || 'Error al subir imagenes');
  }

  const data = await response.json();

  // URLs can be:
  // 1. Full URLs from cloud storage (ImgBB) - start with http:// or https://
  // 2. Relative URLs from local storage - start with /uploads/
  const baseUrl = API_URL.replace('/api/v1', '');
  return data.urls.map((url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Already a full URL (from ImgBB or other cloud storage)
      return url;
    }
    // Relative URL - convert to full URL
    return `${baseUrl}${url}`;
  });
}
