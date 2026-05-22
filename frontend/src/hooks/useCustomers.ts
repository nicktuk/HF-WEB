import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerApi } from '@/lib/api';

export function useCustomers(
  apiKey: string,
  params: { search?: string; tag?: string; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: ['customers', params],
    queryFn: () => customerApi.list(apiKey, params),
    enabled: !!apiKey,
    staleTime: 30 * 1000,
  });
}

export function useCustomerByName(apiKey: string, name: string) {
  return useQuery({
    queryKey: ['customer', name],
    queryFn: () => customerApi.getByName(apiKey, name),
    enabled: !!apiKey && !!name,
    staleTime: 30 * 1000,
  });
}

export function useUpdateCustomer(apiKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof customerApi.update>[2] }) =>
      customerApi.update(apiKey, id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', updated.name] });
    },
  });
}

export function useCustomerTags(apiKey: string) {
  return useQuery({
    queryKey: ['customer-tags'],
    queryFn: () => customerApi.getTags(apiKey),
    enabled: !!apiKey,
    staleTime: 5 * 60 * 1000,
  });
}
