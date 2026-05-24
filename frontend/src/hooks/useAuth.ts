'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AdminRole = 'superadmin' | 'product_editor';

// Sessions expire after 12 hours of inactivity
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

interface AuthState {
  apiKey: string | null;
  role: AdminRole | null;
  isAuthenticated: boolean;
  loginTime: number | null;
  login: (apiKey: string, role: AdminRole) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      apiKey: null,
      role: null,
      isAuthenticated: false,
      loginTime: null,

      login: (apiKey: string, role: AdminRole) => {
        set({ apiKey, role, isAuthenticated: true, loginTime: Date.now() });
      },

      logout: () => {
        set({ apiKey: null, role: null, isAuthenticated: false, loginTime: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        apiKey: state.apiKey,
        role: state.role,
        isAuthenticated: state.isAuthenticated,
        loginTime: state.loginTime,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated && state.loginTime) {
          const expired = Date.now() - state.loginTime > SESSION_DURATION_MS;
          if (expired) {
            state.apiKey = null;
            state.role = null;
            state.isAuthenticated = false;
            state.loginTime = null;
          }
        }
      },
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
