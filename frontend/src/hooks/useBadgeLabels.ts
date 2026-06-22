'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBadgeLabels, fetchPublicCatalogSettings, settingsApi, type BadgeLabels } from '@/lib/api';
import { useApiKey } from '@/hooks/useAuth';

export function useCatalogSettings() {
  return useQuery({
    queryKey: ['public-catalog-settings'],
    queryFn: fetchPublicCatalogSettings,
    staleTime: 5 * 60 * 1000,
  });
}

export function useBadgeLabels() {
  return useQuery<BadgeLabels>({
    queryKey: ['badge-labels'],
    queryFn: fetchBadgeLabels,
    staleTime: 0,
  });
}

export function useAdminBadgeSettings() {
  const apiKey = useApiKey() || '';
  return useQuery({
    queryKey: ['admin-badge-settings'],
    queryFn: () => settingsApi.getBadges(apiKey),
    enabled: !!apiKey,
  });
}

export function useUpdateBadge() {
  const apiKey = useApiKey() || '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, text }: { key: string; text: string }) =>
      settingsApi.updateBadge(apiKey, key, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-badge-settings'] });
      queryClient.invalidateQueries({ queryKey: ['badge-labels'] });
    },
  });
}

export function useResetBadge() {
  const apiKey = useApiKey() || '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => settingsApi.resetBadge(apiKey, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-badge-settings'] });
      queryClient.invalidateQueries({ queryKey: ['badge-labels'] });
    },
  });
}
