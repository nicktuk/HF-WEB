import type { Metadata } from 'next';
import Link from 'next/link';

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '';
const SITE_URL = 'https://www.hefaproductos.com.ar';

export const metadata: Metadata = {
  title: 'Envíos a Ezeiza, Canning, Monte Grande y todo el GBA Sur — He·Fa Productos',
  description:
    'He·Fa envía productos para el hogar, bazar y electrodomésticos a Ezeiza, Canning, Monte Grande, Tristán Suárez y todo Argentina. Entrega en 24–48hs en zona sur GBA.',
  alternates: {
    canonical: `${SITE_URL}/envios`,
  },
  openGraph: {
    title: 'Envíos a Ezeiza, Canning, Monte Grande y todo el GBA Sur — He·Fa Productos',
    description:
      'He·Fa envía productos para el hogar, bazar y electrodomésticos a Ezeiza, Canning, Monte Grande, Tristán Suárez y todo Argentina. Entrega en 24–48hs en zona sur GBA.',
    url: `${SITE_URL}/envios`,
    siteName: 'He·Fa Productos',
    type: 'website',
    locale: 'es_AR',
  },
};

export default function EnviosPage() {
  const waUrl = WHATSAPP_NUMBER
    ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hola! Quiero consultar por envíos.')}`
    : null;

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

      <main className="container mx-auto px-4 py-10 pb-24 max-w-3xl">

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">
          Envíos a domicilio — Zona sur GBA y todo el país
        </h1>

        <p className="text-lg text-gray-600 mb-10 leading-relaxed">
          En <strong>He·Fa Productos</strong> hacemos envíos de bazar, electrodomésticos, productos térmicos
          y todo tipo de artículos para el hogar a toda la zona sur del Gran Buenos Aires y al interior del país.
        </p>

        {/* Zonas de cobertura */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Zonas de cobertura</h2>

          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            <div className="p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Zona sur GBA — Entrega en 24 a 48 horas hábiles</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Ezeiza, Canning, Monte Grande, Tristán Suárez, Guernica, Temperley, Lomas de Zamora, Lanús, Avellaneda
                y localidades cercanas. Coordinamos el envío directo a tu domicilio.
              </p>
            </div>
            <div className="p-5">
              <h3 className="font-semibold text-gray-800 mb-1">Todo el país — Entrega en 3 a 5 días hábiles</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Enviamos a cualquier punto de Argentina a través de correo y transporte de cargas.
                El tiempo de entrega varía según la distancia y el servicio disponible en tu zona.
              </p>
            </div>
          </div>
        </section>

        {/* Productos */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">¿Qué productos enviamos?</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              'Bazar y cocina',
              'Electrodomésticos',
              'Productos térmicos (termos, mate, etc.)',
              'Artículos para el hogar',
              'Herramientas y ferretería',
              'Textil y blanquería',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700">
                <span className="text-green-500 font-bold">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Cómo funciona */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">¿Cómo funciona el envío?</h2>
          <ol className="space-y-4">
            {[
              { n: '1', t: 'Elegí tus productos', d: 'Explorá el catálogo y seleccioná lo que necesitás.' },
              { n: '2', t: 'Consultá por WhatsApp', d: 'Envianos los productos que te interesan y te confirmamos disponibilidad y precio final con envío.' },
              { n: '3', t: 'Coordinamos la entrega', d: 'Acordamos el método de envío según tu ubicación y lo despachamos en el plazo indicado.' },
            ].map(({ n, t, d }) => (
              <li key={n} className="flex gap-4 bg-white border border-gray-200 rounded-xl p-4">
                <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-[#0D1B2A] text-white text-sm font-bold">{n}</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{t}</p>
                  <p className="text-gray-500 text-sm">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* CTA */}
        <section className="bg-[#0D1B2A] rounded-2xl p-6 text-center">
          <h2 className="text-lg font-semibold text-white mb-2">¿Querés saber el costo de envío a tu zona?</h2>
          <p className="text-zinc-400 text-sm mb-5">
            Consultanos por WhatsApp y te respondemos a la brevedad.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {waUrl && (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Consultar por WhatsApp
              </a>
            )}
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold px-6 py-3 transition-colors text-sm border border-white/20"
            >
              Ver catálogo
            </Link>
          </div>
        </section>

        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            ← Volver al catálogo
          </Link>
        </div>
      </main>
    </div>
  );
}
