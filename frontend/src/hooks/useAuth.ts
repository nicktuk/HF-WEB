'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  apiKey: string | null;
  isAuthenticated: boolean;
  login: (apiKey: string) => void;
  logout: () => void;
}

/**
 * Simple auth store using Zustand with persistence.
 * Stores the API key in localStorage.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      apiKey: null,
      isAuthenticated: false,

      login: (apiKey: string) => {
        set({ apiKey, isAuthenticated: true });
      },

      logout: () => {
        set({ apiKey: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ apiKey: state.apiKey, isAuthenticated: state.isAuthenticated }),
    }
  )
);

/**
 * Hook to check if user is authenticated
 */
export function useIsAuthenticated(): boolean {
  return useAuth((state) => state.isAuthenticated);
}

/**
 * Hook to get API key
 */
export function useApiKey(): string | null {
  return useAuth((state) => state.apiKey);
}
