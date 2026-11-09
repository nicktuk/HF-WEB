/**
 * Textos del tema navideño. Si el tema se muestra o no lo decide el toggle
 * "Tema navideño" de Admin → Catálogo (setting SEASONAL_THEME_ENABLED),
 * que el layout lee en el servidor y reparte con SeasonalThemeProvider.
 */
export const seasonalTheme = {
  name: 'navidad',
  announcement: '¡Feliz Navidad! · Entregas en 24–48 hs en zona sur',
  announcementShort: '¡Feliz Navidad! · Entregas en 24–48 hs',
  navidadHref: '/?featured=true',
  bannerTitle: '¡Navidad en HE·FA!',
  bannerSubtitle: 'Todo para la mesa navideña, el brindis y el arbolito.',
  bannerSubtitleShort: 'Mesa, brindis y arbolito.',
  bannerCta: 'Ver lo navideño',
  deliveryCutoffText: 'Pedí antes del 22/12 y llega para Nochebuena.',
};

const SERVER_API_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:8000/api/v1';

/** Segundos que el servidor cachea el valor del toggle antes de volver a consultarlo. */
export const SEASONAL_THEME_REVALIDATE_SECONDS = 60;

/**
 * Solo servidor: lee el toggle del admin. Ante cualquier error devuelve false
 * (el sitio queda sin tema, nunca roto).
 */
export async function fetchSeasonalThemeEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_API_URL}/admin/settings/public/catalog-settings`, {
      next: { revalidate: SEASONAL_THEME_REVALIDATE_SECONDS },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { seasonal_theme_enabled?: boolean };
    return data.seasonal_theme_enabled === true;
  } catch {
    return false;
  }
}
