'use client';

import { createContext, useContext, type ReactNode } from 'react';

const SeasonalThemeContext = createContext(false);

export function SeasonalThemeProvider({ active, children }: { active: boolean; children: ReactNode }) {
  return <SeasonalThemeContext.Provider value={active}>{children}</SeasonalThemeContext.Provider>;
}

/** true si el tema navideño está activo (toggle del admin, leído en el servidor). */
export function useSeasonalTheme(): boolean {
  return useContext(SeasonalThemeContext);
}
