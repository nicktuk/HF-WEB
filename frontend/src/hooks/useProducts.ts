'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicApi, adminApi } from '@/lib/api';
import type { ProductCreateForm, ProductCreateManualForm, ProductUpdateForm, SaleCreateForm } from '@/types';

// ============================================
// Public Hooks
// ============================================

export function usePublicProducts(params: {
  page?: number;
  limit?: number;
  category?: string;
  subcategory?: string;
  search?: string;
  featured?: boolean;
  immediate_delivery?: boolean;
} = {}) {
  return useQuery({
    queryKey: ['public-products', params],
    queryFn: () => publicApi.getProducts(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePublicProduct(slug: string) {
  return useQuery({
    queryKey: ['public-product', slug],
    queryFn: () => publicApi.getProduct(slug),
    staleTime: 5 * 60 * 1000,
    enabled: !!slug,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: () => publicApi.getCategories(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useSubcategories(category?: string) {
  return useQuery({
    queryKey: ['subcategories', category],
    queryFn: () => publicApi.getSubcategories(category),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useAdminCategories() {
  return useQuery({
    queryKey: ['admin-categories'],
    queryFn: async () => {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/categories`);
      if (!res.ok) throw new Error('Error al cargar categorías');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Admin Hooks
// ============================================

export function useAdminProducts(
  apiKey: string,
  params: {
    page?: number;
    limit?: number;
    enabled?: boolean;
    source_website_id?: number;
    search?: string;
    category?: string;
    subcategory?: string;
    is_featured?: boolean;
    is_immediate_delivery?: boolean;
    in_stock?: boolean;
    price_range?: string;
  } = {}
) {
  return useQuery({
    queryKey: ['admin-products', params],
    queryFn: () => adminApi.getProducts(apiKey, params),
    staleTime: 30 * 1000, // 30 seconds for admin
    enabled: !!apiKey,
  });
}

export function usePendingPriceChanges(apiKey: string) {
  return useQuery({
    queryKey: ['pending-price-changes'],
    queryFn: () => adminApi.getPendingPriceChanges(apiKey),
    staleTime: 30 * 1000,
    enabled: !!apiKey,
  });
}

export function useApprovePendingPriceChanges(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productIds: number[]) => adminApi.approvePendingPriceChanges(apiKey, productIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-price-changes'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}

export function useRejectPendingPriceChanges(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productIds: number[]) => adminApi.rejectPendingPriceChanges(apiKey, productIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-price-changes'] });
    },
  });
}

export function useStockSummary(apiKey: string, productIds: number[]) {
  return useQuery({
    queryKey: ['stock-summary', productIds],
    queryFn: () => adminApi.getStockSummary(apiKey, productIds),
    staleTime: 30 * 1000,
    enabled: !!apiKey && productIds.length > 0,
  });
}

export function useStockPurchases(apiKey: string, productId?: number) {
  return useQuery({
    queryKey: ['stock-purchases', productId],
    queryFn: () => adminApi.getStockPurchases(apiKey, productId),
    staleTime: 30 * 1000,
    enabled: !!apiKey,
  });
}

export function useUnmatchedStockPurchases(apiKey: string) {
  return useQuery({
    queryKey: ['stock-purchases-unmatched'],
    queryFn: () => adminApi.getStockPurchases(apiKey, undefined, true),
    staleTime: 30 * 1000,
    enabled: !!apiKey,
  });
}

export function useUpdateStockPurchase(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ purchaseId, productId }: { purchaseId: number; productId: number | null }) =>
      adminApi.updateStockPurchase(apiKey, purchaseId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases-unmatched'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}

export function useCreateSale(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaleCreateForm) => adminApi.createSale(apiKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases-unmatched'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
  });
}

export function useSales(apiKey: string, limit: number = 50, search?: string) {
  return useQuery({
    queryKey: ['sales', limit, search],
    queryFn: () => adminApi.listSales(apiKey, limit, search),
    staleTime: 30 * 1000,
    enabled: !!apiKey,
  });
}

export function useSale(apiKey: string, saleId: number) {
  return useQuery({
    queryKey: ['sale', saleId],
    queryFn: () => adminApi.getSale(apiKey, saleId),
    staleTime: 30 * 1000,
    enabled: !!apiKey && !!saleId,
  });
}

export function useUpdateSale(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      saleId,
      data,
    }: {
      saleId: number;
      data: { delivered?: boolean; paid?: boolean; customer_name?: string; notes?: string; installments?: number; seller?: 'Facu' | 'Heber' };
    }) =>
      adminApi.updateSale(apiKey, saleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases'] });
    },
  });
}

export function useDeleteSale(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (saleId: number) => adminApi.deleteSale(apiKey, saleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases'] });
    },
  });
}

export function useAdminProduct(apiKey: string, id: number) {
  return useQuery({
    queryKey: ['admin-product', id],
    queryFn: () => adminApi.getProduct(apiKey, id),
    staleTime: 30 * 1000,
    enabled: !!apiKey && !!id,
  });
}

export function useCreateProduct(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProductCreateForm) => adminApi.createProduct(apiKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}

export function useBulkSetWholesaleMarkup(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      markupPercentage,
      onlyEnabled,
      sourceWebsiteId,
    }: {
      markupPercentage: number;
      onlyEnabled?: boolean;
      sourceWebsiteId?: number;
    }) => adminApi.bulkSetWholesaleMarkup(apiKey, markupPercentage, onlyEnabled, sourceWebsiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}
export function useCreateProductManual(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ProductCreateManualForm) => adminApi.createProductManual(apiKey, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}

export function useUpdateProduct(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: ProductUpdateForm }) =>
      adminApi.updateProduct(apiKey, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
    },
  });
}

export function useDeleteProduct(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminApi.deleteProduct(apiKey, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
    },
  });
}

export function useRescrapeProduct(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => adminApi.rescrapeProduct(apiKey, id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['admin-product', id] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}

export function useMarketPrices(apiKey: string, productId: number) {
  return useQuery({
    queryKey: ['market-prices', productId],
    queryFn: () => adminApi.getMarketPrices(apiKey, productId),
    staleTime: 5 * 60 * 1000,
    enabled: !!apiKey && !!productId,
  });
}

export function useRefreshMarketPrices(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, options }: {
      productId: number;
      options?: { force?: boolean; search_query?: string };
    }) => adminApi.refreshMarketPrices(apiKey, productId, options),
    onSuccess: (_, { productId }) => {
      queryClient.invalidateQueries({ queryKey: ['market-prices', productId] });
      queryClient.invalidateQueries({ queryKey: ['admin-product', productId] });
    },
  });
}

export function usePriceComparison(apiKey: string, productId: number) {
  return useQuery({
    queryKey: ['price-comparison', productId],
    queryFn: () => adminApi.getPriceComparison(apiKey, productId),
    staleTime: 5 * 60 * 1000,
    enabled: !!apiKey && !!productId,
  });
}

export function useBulkSetMarkup(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ markupPercentage, onlyEnabled, sourceWebsiteId }: {
      markupPercentage: number;
      onlyEnabled?: boolean;
      sourceWebsiteId?: number;
    }) => adminApi.bulkSetMarkup(apiKey, markupPercentage, onlyEnabled, sourceWebsiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
    },
  });
}

export function useActivateAllInactive(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (markupPercentage: number) =>
      adminApi.activateAllInactive(apiKey, markupPercentage),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
    },
  });
}

export function useActivateSelected(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productIds, markupPercentage, category, subcategory }: { productIds: number[]; markupPercentage: number; category?: string; subcategory?: string }) =>
      adminApi.activateSelected(apiKey, productIds, markupPercentage, category, subcategory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    },
  });
}

export function useChangeCategorySelected(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productIds, category }: { productIds: number[]; category: string }) =>
      adminApi.changeCategorySelected(apiKey, productIds, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    },
  });
}

export function useChangeSubcategorySelected(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productIds, subcategory }: { productIds: number[]; subcategory: string }) =>
      adminApi.changeSubcategorySelected(apiKey, productIds, subcategory),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
    },
  });
}

export function useAdminSubcategories(categoryId?: number) {
  return useQuery({
    queryKey: ['admin-subcategories', categoryId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (categoryId) params.set('category_id', categoryId.toString());
      params.set('include_inactive', 'true');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/subcategories?${params}`);
      if (!res.ok) throw new Error('Error al cargar subcategorías');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useDisableSelected(apiKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (productIds: number[]) =>
      adminApi.disableSelected(apiKey, productIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
    },
  });
}

// Source Websites

export function useSourceWebsites(apiKey: string) {
  return useQuery({
    queryKey: ['source-websites'],
    queryFn: () => adminApi.getSourceWebsites(apiKey),
    staleTime: 5 * 60 * 1000,
    enabled: !!apiKey,
  });
}

// ============================================
// Purchases with Payments Hooks
// ============================================

export function usePurchases(
  apiKey: string,
  params: {
    page?: number;
    limit?: number;
    supplier?: string;
    date_from?: string;
    date_to?: string;
    product_id?: number;
  } = {}
) {
  return useQuery({
    queryKey: ['purchases', params],
    queryFn: () => adminApi.getPurchases(apiKey, params),
    staleTime: 30 * 1000,
    enabled: !!apiKey,
  });
}

export function useSuppliers(apiKey: string) {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: () => adminApi.getSuppliers(apiKey),
    staleTime: 5 * 60 * 1000,
    enabled: !!apiKey,
  });
}

export function usePurchaseDetail(apiKey: string, purchaseId: number | null) {
  return useQuery({
    queryKey: ['purchase-detail', purchaseId],
    queryFn: () => adminApi.getPurchaseDetail(apiKey, purchaseId!),
    staleTime: 30 * 1000,
    enabled: !!apiKey && !!purchaseId,
  });
}

export function useAddPaymentToPurchase(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      purchaseId,
      payment,
    }: {
      purchaseId: number;
      payment: { payer: 'Facu' | 'Heber'; amount: number; payment_method: string };
    }) => adminApi.addPaymentToPurchase(apiKey, purchaseId, payment),
    onSuccess: (_, { purchaseId }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-detail', purchaseId] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases-by-payer'] });
    },
  });
}

export function useDeletePayment(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ purchaseId, paymentId }: { purchaseId: number; paymentId: number }) =>
      adminApi.deletePayment(apiKey, purchaseId, paymentId),
    onSuccess: (_, { purchaseId }) => {
      queryClient.invalidateQueries({ queryKey: ['purchase-detail', purchaseId] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchases-by-payer'] });
    },
  });
}

export function usePurchasesByPayer(apiKey: string) {
  return useQuery({
    queryKey: ['purchases-by-payer'],
    queryFn: () => adminApi.getPurchasesByPayer(apiKey),
    staleTime: 30 * 1000,
    enabled: !!apiKey,
  });
}

export function useImportStockWithSupplier(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ file }: { file: File }) =>
      adminApi.importStockCsvWithSupplier(apiKey, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });
}
