'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminRole = 'superadmin' | 'product_editor';

interface AuthState {
  apiKey: string | null;
  role: AdminRole | null;
  isAuthenticated: boolean;
  login: (apiKey: string, role: AdminRole) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      apiKey: null,
      role: null,
      isAuthenticated: false,

      login: (apiKey: string, role: AdminRole) => {
        set({ apiKey, role, isAuthenticated: true });
      },

      logout: () => {
        set({ apiKey: null, role: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        apiKey: state.apiKey,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export function useIsAuthenticated(): boolean {
  return useAuth((state) => state.isAuthenticated);
}

export function useApiKey(): string | null {
  return useAuth((state) => state.apiKey);
}

export function useRole(): AdminRole | null {
  return useAuth((state) => state.role);
}

export function useIsSuperadmin(): boolean {
  return useAuth((state) => state.role === 'superadmin');
}
