'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HowWeWorkModal } from '@/components/public/HowWeWorkModal';
import { trackPublicEvent } from '@/lib/analytics';

export function Footer() {
  const [howWeWorkOpen, setHowWeWorkOpen] = useState(false);
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || 'HeFa - Productos';

  return (
    <>
      {/* ─── FOOTER ──────────────────────────────────────────────────── */}
      <footer className="mt-0 bg-[#0D1B2A]">
        {/* Top accent line */}
        <div className="h-1 bg-gradient-to-r from-primary-600 via-primary-400 to-primary-600" />

        <div className="container mx-auto px-4 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            {/* Brand column */}
            <div className="sm:col-span-1">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 border border-white/20">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                </div>
                <span className="text-xl font-black tracking-[0.18em] text-white">HE·FA</span>
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Distribuidora mayorista y minorista de productos para el hogar. Electrodomésticos, bazar, herramientas y más.
              </p>
            </div>

            {/* Contact column */}
            <div className="sm:col-span-1">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Contacto</h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackPublicEvent('whatsapp_click', { metadata: { origin: 'footer' } })}
                    className="flex items-center gap-2.5 text-sm text-zinc-400 hover:text-green-400 transition-colors group"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 text-green-500 group-hover:bg-green-500/20 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </span>
                    WhatsApp
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com/hefa.productos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm text-zinc-400 hover:text-pink-400 transition-colors group"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-400 group-hover:bg-pink-500/20 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                      </svg>
                    </span>
                    @hefa.productos
                  </a>
                </li>
                <li>
                  <a
                    href="https://whatsapp.com/channel/0029Vb7G9P0CRs1h0hfXWM1B"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 text-sm text-zinc-400 hover:text-green-400 transition-colors group"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 text-green-500 group-hover:bg-green-500/20 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </span>
                    Nuestro canal de whatsapp
                  </a>
                </li>
              </ul>
            </div>

            {/* Info column */}
            <div className="sm:col-span-1">
              <h4 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4">Información</h4>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={() => setHowWeWorkOpen(true)}
                    className="text-sm text-zinc-400 hover:text-white transition-colors text-left"
                  >
                    ¿Cómo funciona?
                  </button>
                </li>
                <li>
                  <a href="/envios" className="text-sm text-zinc-400 hover:text-white transition-colors">
                    Información de envíos
                  </a>
                </li>
                <li>
                  <Link href="/devoluciones" className="text-sm text-zinc-400 hover:text-white transition-colors">
                    Cambios y devoluciones
                  </Link>
                </li>
                <li>
                  <Link href="/devoluciones#boton-de-arrepentimiento" className="text-sm text-zinc-400 hover:text-white transition-colors">
                    Botón de arrepentimiento
                  </Link>
                </li>
                <li>
                  <span className="text-sm text-zinc-500">
                    Zona: Argentina
                  </span>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-white/8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <p className="text-xs text-zinc-600">
              © {new Date().getFullYear()} {siteName}. Todos los derechos reservados.
            </p>
            <p className="text-xs text-zinc-600">
              Distribución mayorista · Argentina
            </p>
          </div>
        </div>
      </footer>

      {/* How We Work Modal */}
      <HowWeWorkModal isOpen={howWeWorkOpen} onClose={() => setHowWeWorkOpen(false)} />
    </>
  );
}
