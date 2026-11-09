export const seasonalTheme = {
  name: 'navidad',
  enabled: process.env.NEXT_PUBLIC_SEASONAL_THEME === 'navidad',
  startDate: '2026-11-10',
  endDate: '2027-01-06',
  announcement: '¡Feliz Navidad! · Entregas en 24–48 hs en zona sur',
  announcementShort: '¡Feliz Navidad! · Entregas en 24–48 hs',
  navidadHref: '/?featured=true',
  bannerTitle: '¡Navidad en HE·FA!',
  bannerSubtitle: 'Todo para la mesa navideña, el brindis y el arbolito.',
  bannerSubtitleShort: 'Mesa, brindis y arbolito.',
  bannerCta: 'Ver lo navideño',
  deliveryCutoffText: 'Pedí antes del 22/12 y llega para Nochebuena.',
};

export function isSeasonalThemeActive(now: Date = new Date()): boolean {
  if (!seasonalTheme.enabled) return false;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(now);
  return today >= seasonalTheme.startDate && today <= seasonalTheme.endDate;
}
