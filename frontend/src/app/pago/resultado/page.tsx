'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle, Clock } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { publicApi } from '@/lib/api';
import { trackPublicEvent } from '@/lib/analytics';

type ResultState = 'checking' | 'completed' | 'failed' | 'timeout';

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 16; // ~40s, cubre el delay típico del webhook de MP

export default function PagoResultadoPage() {
  return (
    <Suspense fallback={<PagoResultadoFallback />}>
      <PagoResultadoContent />
    </Suspense>
  );
}

function PagoResultadoFallback() {
  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f7f4ef' }}>
      <header className="bg-[#0D1B2A] py-4 px-4">
        <div className="container mx-auto">
          <Link href="/" className="text-xl font-black tracking-[0.18em] text-white hover:text-primary-300 transition-colors">
            HE·FA
          </Link>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <Loader2 className="h-12 w-12 text-[#009ee3] animate-spin" />
      </main>
    </div>
  );
}

function PagoResultadoContent() {
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const { items, clearCart } = useCart();
  const [state, setState] = useState<ResultState>('checking');
  const [saleId, setSaleId] = useState<number | null>(null);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!ref) {
      setState('failed');
      return;
    }

    let attempts = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const result = await publicApi.getMPOrderStatus(ref!);
        if (cancelled) return;

        if (result.status === 'completed') {
          setSaleId(result.sale_id ?? null);
          setState('completed');
          if (!trackedRef.current) {
            trackedRef.current = true;
            const value = items.reduce((sum, i) => {
              const price = i.product.installments_3 && i.product.installment_price
                ? i.product.installment_price * 3
                : (i.product.price ?? 0);
              return sum + price * i.quantity;
            }, 0);
            trackPublicEvent('purchase', {
              value,
              num_items: items.reduce((s, i) => s + i.quantity, 0),
              content_ids: items.map(i => i.product.id),
              metadata: { payment_method: 'Mercado Pago' },
            });
          }
          clearCart();
          return;
        }

        if (result.status === 'failed') {
          setState('failed');
          return;
        }

        attempts += 1;
        if (attempts >= MAX_ATTEMPTS) {
          setState('timeout');
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        attempts += 1;
        if (attempts >= MAX_ATTEMPTS) {
          setState('timeout');
          return;
        }
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    poll();
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref]);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f7f4ef' }}>
      <header className="bg-[#0D1B2A] py-4 px-4">
        <div className="container mx-auto">
          <Link href="/" className="text-xl font-black tracking-[0.18em] text-white hover:text-primary-300 transition-colors">
            HE·FA
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-zinc-100 px-6 py-8 text-center space-y-4">
          {state === 'checking' && (
            <>
              <Loader2 className="h-12 w-12 text-[#009ee3] animate-spin mx-auto" />
              <h1 className="text-lg font-bold text-zinc-900">Confirmando tu pago...</h1>
              <p className="text-sm text-zinc-500">Esto puede tardar unos segundos, no cierres esta página.</p>
            </>
          )}

          {state === 'completed' && (
            <>
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
              <h1 className="text-lg font-bold text-zinc-900">¡Pago confirmado!</h1>
              {saleId && (
                <p className="text-sm text-zinc-500">
                  Pedido <span className="font-bold text-zinc-800">#{saleId}</span>
                </p>
              )}
              <p className="text-sm text-zinc-500">Te vamos a contactar para coordinar la entrega.</p>
            </>
          )}

          {state === 'failed' && (
            <>
              <XCircle className="h-12 w-12 text-rose-500 mx-auto" />
              <h1 className="text-lg font-bold text-zinc-900">El pago no se pudo confirmar</h1>
              <p className="text-sm text-zinc-500">Podés volver al carrito e intentar de nuevo.</p>
            </>
          )}

          {state === 'timeout' && (
            <>
              <Clock className="h-12 w-12 text-amber-500 mx-auto" />
              <h1 className="text-lg font-bold text-zinc-900">Estamos confirmando tu pago</h1>
              <p className="text-sm text-zinc-500">Puede demorar unos minutos más. Si el pago se acreditó, te vamos a contactar igual.</p>
            </>
          )}

          <Link
            href="/"
            className="inline-block w-full rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 transition-all"
          >
            Volver al catálogo
          </Link>
        </div>
      </main>
    </div>
  );
}
