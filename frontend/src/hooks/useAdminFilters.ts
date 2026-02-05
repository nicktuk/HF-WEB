import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AdminFiltersState {
  // Product filters
  search: string;
  enabledFilter: boolean | undefined;
  sourceFilter: number | undefined;
  categoryFilter: string | undefined;
  featuredFilter: boolean | undefined;
  priceRangeFilter: string | undefined;
  page: number;
  limit: number;

  // Actions
  setSearch: (search: string) => void;
  setEnabledFilter: (enabled: boolean | undefined) => void;
  setSourceFilter: (sourceId: number | undefined) => void;
  setCategoryFilter: (category: string | undefined) => void;
  setFeaturedFilter: (featured: boolean | undefined) => void;
  setPriceRangeFilter: (priceRange: string | undefined) => void;
  setPage: (page: number) => void;
  setLimit: (limit: number) => void;
  resetFilters: () => void;
}

const initialState = {
  search: '',
  enabledFilter: undefined as boolean | undefined,
  sourceFilter: undefined as number | undefined,
  categoryFilter: undefined as string | undefined,
  featuredFilter: undefined as boolean | undefined,
  priceRangeFilter: undefined as string | undefined,
  page: 1,
  limit: 50,
};

export const useAdminFilters = create<AdminFiltersState>()(
  persist(
    (set) => ({
      ...initialState,

      setSearch: (search) => set({ search, page: 1 }),
      setEnabledFilter: (enabledFilter) => set({ enabledFilter, page: 1 }),
      setSourceFilter: (sourceFilter) => set({ sourceFilter, page: 1 }),
      setCategoryFilter: (categoryFilter) => set({ categoryFilter, page: 1 }),
      setFeaturedFilter: (featuredFilter) => set({ featuredFilter, page: 1 }),
      setPriceRangeFilter: (priceRangeFilter) => set({ priceRangeFilter, page: 1 }),
      setPage: (page) => set({ page }),
      setLimit: (limit) => set({ limit, page: 1 }),
      resetFilters: () => set(initialState),
    }),
    {
      name: 'admin-filters',
    }
  )
);
