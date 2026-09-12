'use client';

import Link from 'next/link';
import { Store } from 'lucide-react';
import { trackPublicEvent } from '@/lib/analytics';

const SOLICITUD_URL = '/comercios/solicitud';

function track(origin: string) {
  trackPublicEvent('comercio_access_click', { metadata: { origin } });
}

// Botón fijo, esquina opuesta al de WhatsApp para no superponerse.
export function FloatingComercioButton() {
  return (
    <Link
      href={SOLICITUD_URL}
      onClick={() => track('floating_button')}
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-primary-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-primary-700"
      aria-label="Solicitar acceso mayorista"
    >
      <Store className="h-5 w-5" />
      <span>Acceso mayorista</span>
    </Link>
  );
}

// Botón compacto para el header, junto a "¿Cómo funciona?".
export function ComercioHeaderButton() {
  return (
    <Link
      href={SOLICITUD_URL}
      onClick={() => track('header_button')}
      className="flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition-all duration-200"
      aria-label="Solicitar acceso mayorista"
    >
      <Store className="h-3.5 w-3.5 text-blue-300" />
      <span className="hidden sm:inline">Mayorista</span>
    </Link>
  );
}

// Link para la columna "Información" del footer.
export function ComercioFooterLink() {
  return (
    <Link
      href={SOLICITUD_URL}
      onClick={() => track('footer_link')}
      className="text-sm text-zinc-400 hover:text-white transition-colors"
    >
      ¿Tenés un local? Comprá al por mayor
    </Link>
  );
}
