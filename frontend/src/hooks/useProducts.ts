'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { publicApi, adminApi } from '@/lib/api';
import type { ProductCreateForm, ProductCreateManualForm, ProductUpdateForm } from '@/types';

// ============================================
// Public Hooks
// ============================================

export function usePublicProducts(params: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  featured?: boolean;
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
  } = {}
) {
  return useQuery({
    queryKey: ['admin-products', params],
    queryFn: () => adminApi.getProducts(apiKey, params),
    staleTime: 30 * 1000, // 30 seconds for admin
    enabled: !!apiKey,
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
    mutationFn: ({ markupPercentage, onlyEnabled }: {
      markupPercentage: number;
      onlyEnabled?: boolean;
    }) => adminApi.bulkSetMarkup(apiKey, markupPercentage, onlyEnabled),
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
    mutationFn: ({ productIds, markupPercentage, category }: { productIds: number[]; markupPercentage: number; category?: string }) =>
      adminApi.activateSelected(apiKey, productIds, markupPercentage, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      queryClient.invalidateQueries({ queryKey: ['public-products'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
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
