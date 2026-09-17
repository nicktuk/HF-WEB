'use client'

// Atribución de cartera por link/QR personal del vendedor: el link cae
// directo en el catálogo con ?v=<vendedor_id> (nunca en un login, por
// especificación). Se persiste en cookie no-httpOnly por 30 días para que
// sobreviva la navegación hasta que el visitante complete la solicitud de
// alta, sin importar cuántas páginas recorra en el medio.
const COOKIE_NAME = 'hefa_ref_vendedor'
const MAX_AGE_DIAS = 30

export function capturarVendedorRef(): void {
  if (typeof window === 'undefined') return
  const v = new URLSearchParams(window.location.search).get('v')
  if (!v || !/^\d+$/.test(v)) return
  document.cookie = `${COOKIE_NAME}=${v}; max-age=${MAX_AGE_DIAS * 24 * 60 * 60}; path=/; samesite=lax`
}

export function obtenerVendedorRef(): number | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=(\\d+)`))
  return match ? parseInt(match[1], 10) : null
}
