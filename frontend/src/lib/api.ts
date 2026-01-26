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
    search?: string;
    featured?: boolean;
  } = {}): Promise<PaginatedResponse<ProductPublic>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.category) searchParams.set('category', params.category);
    if (params.search) searchParams.set('search', params.search);
    if (params.featured !== undefined) searchParams.set('featured', params.featured.toString());

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
  async getCategories(): Promise<string[]> {
    return fetchAPI('/public/categories');
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
      category?: string;
    } = {}
  ): Promise<PaginatedResponse<ProductAdmin>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', params.page.toString());
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.enabled !== undefined) searchParams.set('enabled', params.enabled.toString());
    if (params.source_website_id) searchParams.set('source_website_id', params.source_website_id.toString());
    if (params.search) searchParams.set('search', params.search);
    if (params.category) searchParams.set('category', params.category);

    const query = searchParams.toString();
    return fetchAPI(`/admin/products${query ? `?${query}` : ''}`, {}, apiKey);
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
    onlyEnabled: boolean = true
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/bulk-markup', {
      method: 'POST',
      body: JSON.stringify({
        markup_percentage: markupPercentage,
        only_enabled: onlyEnabled,
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
    markupPercentage: number
  ): Promise<MessageResponse> {
    return fetchAPI('/admin/products/activate-selected', {
      method: 'POST',
      body: JSON.stringify({
        product_ids: productIds,
        markup_percentage: markupPercentage,
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

  // Convert relative URLs to full URLs (backend returns /uploads/filename.jpg)
  // We need full URL since the API is on a different port/host than the frontend
  const baseUrl = API_URL.replace('/api/v1', '');
  return data.urls.map((url: string) => `${baseUrl}${url}`);
}
