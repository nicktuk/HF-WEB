import type { Metadata } from 'next';
import Link from 'next/link';
import { HeartHandshake, Meh, Package, Wrench } from 'lucide-react';
import { Footer } from '@/components/public/Footer';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';
const SITE_URL = 'https://www.hefaproductos.com.ar';

const TITLE = 'Cambios y devoluciones | HEFA Productos';
const DESCRIPTION =
  'Comprá tranquilo en HEFA. Si algo no salió como esperabas, lo resolvemos por WhatsApp: cambios, devoluciones y garantía sin vueltas.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: `${SITE_URL}/devoluciones`,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/devoluciones`,
    siteName: 'He·Fa Productos',
    type: 'website',
    locale: 'es_AR',
  },
};

const escenarios = [
  {
    icon: Meh,
    iconBg: 'bg-pink-100',
    iconColor: 'text-pink-600',
    titulo: 'Me arrepentí de la compra',
    texto:
      'Puede pasar. Escribinos y coordinamos la devolución. El producto tiene que estar sin uso y con su embalaje original.',
  },
  {
    icon: Package,
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    titulo: 'Llegó dañado o no era lo que pedí',
    texto:
      'Escribinos con una foto del producto y del paquete. Lo resolvemos con un reemplazo o la devolución de tu dinero.',
  },
  {
    icon: Wrench,
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    titulo: 'Falló con el uso',
    texto:
      'Nuestros productos tienen garantía. Los electrodomésticos además cuentan con garantía oficial de fábrica. Contanos qué pasó y gestionamos el cambio o la reparación.',
  },
];

const pasos = [
  'Escribinos por WhatsApp con tu número de pedido',
  'Contanos qué pasó (si aplica, mandá una foto)',
  'Te acompañamos hasta resolverlo',
];

function whatsappUrl(message: string): string | null {
  if (!WHATSAPP_NUMBER) return null;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export default function DevolucionesPage() {
  const mainCtaUrl = whatsappUrl('Hola! Quiero gestionar un cambio o devolución. Mi número de pedido es: ');
  const arrepentimientoCtaUrl = whatsappUrl('Hola! Quiero ejercer el botón de arrepentimiento. Mi número de pedido es: ');

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f4ef' }}>
      {/* Header simple */}
      <header className="bg-[#0D1B2A] py-4 px-4">
        <div className="container mx-auto">
          <Link href="/" className="text-xl font-black tracking-[0.18em] text-white hover:text-primary-300 transition-colors">
            HE·FA
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10 pb-16 max-w-4xl">
        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 text-primary-600 mb-5">
            <HeartHandshake className="w-8 h-8" aria-hidden="true" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
            Cambios y devoluciones, sin vueltas
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Comprá tranquilo. Si algo no salió como esperabas, lo resolvemos por WhatsApp, como todo en HEFA.
          </p>
        </div>

        {/* Escenarios */}
        <section className="mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {escenarios.map(({ icon: Icon, iconBg, iconColor, titulo, texto }) => (
              <div key={titulo} className="bg-white rounded-2xl border border-gray-200 p-6">
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${iconBg} ${iconColor} mb-4`}>
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{titulo}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pasos de gestión */}
        <section className="mb-12">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">¿Cómo lo gestiono?</h2>
          <ol className="space-y-4">
            {pasos.map((paso, i) => (
              <li key={paso} className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4">
                <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#0D1B2A] text-white text-sm font-bold">
                  {i + 1}
                </span>
                <p className="text-gray-700 text-sm leading-relaxed self-center">{paso}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA principal */}
        <section className="text-center mb-14">
          {mainCtaUrl && (
            <a
              href={mainCtaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-full bg-[#25D366] hover:bg-[#20bd5a] text-white font-semibold px-8 py-4 transition-colors text-base shadow-sm"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Iniciar gestión por WhatsApp
            </a>
          )}
        </section>

        {/* Sección legal: Botón de arrepentimiento */}
        <section id="boton-de-arrepentimiento" className="bg-gray-100 rounded-2xl p-6 md:p-8 scroll-mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Botón de arrepentimiento</h2>
          <p className="text-xs text-gray-600 leading-relaxed mb-3">
            Si compraste a distancia (por la web o por WhatsApp), tenés derecho a arrepentirte de la compra dentro de
            los 10 días corridos desde que recibiste el producto, sin necesidad de dar motivos, según la Ley 24.240 de
            Defensa del Consumidor y la Resolución 424/2020.
          </p>
          <ul className="list-disc list-inside space-y-1 text-xs text-gray-600 mb-5">
            <li>Aplica únicamente a compras realizadas a distancia.</li>
            <li>El producto debe estar sin uso, en las mismas condiciones en que lo recibiste y con su embalaje original.</li>
            <li>La devolución del dinero se realiza por el mismo medio de pago utilizado.</li>
          </ul>
          {arrepentimientoCtaUrl && (
            <a
              href={arrepentimientoCtaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-5 py-2.5 transition-colors text-sm"
            >
              Ejercer botón de arrepentimiento
            </a>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
