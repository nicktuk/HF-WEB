'use client';

import { create } from 'zustand';

export type AdminRole = 'superadmin' | 'product_editor';

const STORAGE_KEY = 'auth-storage';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 horas

interface StoredAuth {
  apiKey: string;
  role: AdminRole;
  loginTime: number;
}

function readStoredAuth(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    // localStorage primero (recordarme), después sessionStorage
    const raw = localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data: StoredAuth = JSON.parse(raw);
    if (!data.apiKey || !data.loginTime) return null;
    if (Date.now() - data.loginTime > SESSION_DURATION_MS) {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function getInitialState() {
  const stored = readStoredAuth();
  if (stored) {
    return { apiKey: stored.apiKey, role: stored.role, isAuthenticated: true };
  }
  return { apiKey: null, role: null, isAuthenticated: false };
}

interface AuthState {
  apiKey: string | null;
  role: AdminRole | null;
  isAuthenticated: boolean;
  login: (apiKey: string, role: AdminRole, remember: boolean) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>()((set) => ({
  ...getInitialState(),

  login: (apiKey: string, role: AdminRole, remember: boolean) => {
    const payload: StoredAuth = { apiKey, role, loginTime: Date.now() };
    if (remember) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.removeItem(STORAGE_KEY);
    }
    set({ apiKey, role, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    set({ apiKey: null, role: null, isAuthenticated: false });
  },
}));

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
