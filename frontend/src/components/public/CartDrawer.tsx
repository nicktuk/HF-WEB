'use client';

import { useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import {
  X, ShoppingCart, Trash2, Plus, Minus,
  Banknote, ChevronLeft, CheckCircle2, Loader2,
} from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';
import { publicApi, resolveImageUrl } from '@/lib/api';
import { trackPublicEvent } from '@/lib/analytics';

const MercadoPagoPaymentBrick = dynamic(
  () => import('./MercadoPagoPaymentBrick'),
  { ssr: false, loading: () => <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-[#009ee3]" /></div> }
);

type Step = 'cart' | 'checkout' | 'mp-payment' | 'success';
type PaymentFlow = 'card' | 'cash';

interface CheckoutForm {
  name: string;
  phone: string;
  email: string;
  notes: string;
}

export function CartDrawer() {
  const { items, removeItem, updateQuantity, clearCart, isOpen, closeCart } = useCart();
  const [step, setStep] = useState<Step>('cart');
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlow | null>(null);
  const [form, setForm] = useState<CheckoutForm>({ name: '', phone: '', email: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mpPreference, setMpPreference] = useState<{ preference_id: string; public_key: string; amount: number } | null>(null);
  const [mpBrickReady, setMpBrickReady] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('cart');
        setError(null);
        setMpPreference(null);
        setMpBrickReady(false);
      }, 300);
    }
  }, [isOpen]);

  function handleClose() {
    if (step === 'success') {
      clearCart();
      setStep('cart');
      setForm({ name: '', phone: '', email: '', notes: '' });
      setOrderId(null);
      setMpPreference(null);
      setMpBrickReady(false);
    }
    closeCart();
  }

  const isCard = paymentFlow === 'card';

  const displayTotal = useMemo(() =>
    items.reduce((sum, i) => {
      const price = isCard && i.product.installments_3 && i.product.installment_price
        ? i.product.installment_price * 3
        : (i.product.price ?? 0);
      return sum + price * i.quantity;
    }, 0),
    [items, isCard]
  );

  const installmentPerPeriod = useMemo(() => {
    if (!isCard) return null;
    const hasInstallments = items.some(i => i.product.installments_3 && i.product.installment_price);
    if (!hasInstallments) return null;
    return items.reduce((sum, i) => {
      const p = i.product.installments_3 && i.product.installment_price
        ? i.product.installment_price
        : (i.product.price ?? 0) / 3;
      return sum + p * i.quantity;
    }, 0);
  }, [items, isCard]);

  async function handleGoToMPPayment() {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const pref = await publicApi.createMPPreference({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        items: items.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          color: i.color ?? undefined,
          is_card_payment: true,
        })),
      });
      setMpPreference(pref);
      setStep('mp-payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMPProcessPayment(formData: unknown) {
    return publicApi.processMPPayment({
      form_data: formData,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
      items: items.map(i => ({
        product_id: i.product.id,
        quantity: i.quantity,
        color: i.color ?? undefined,
        is_card_payment: true,
      })),
    });
  }

  async function handleSubmitOrder() {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await publicApi.createOrder({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        payment_method: 'Efectivo / Transferencia',
        is_card_payment: false,
        notes: form.notes.trim() || undefined,
        items: items.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          color: i.color ?? undefined,
          is_card_payment: false,
        })),
      });
      setOrderId(result.id);
      setStep('success');
      trackPublicEvent('purchase', {
        value: displayTotal,
        num_items: items.reduce((s, i) => s + i.quantity, 0),
        content_ids: items.map(i => i.product.id),
        metadata: { payment_method: 'Efectivo / Transferencia' },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar el pedido. Intentá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  const canGoToCheckout = items.length > 0 && paymentFlow !== null;
  const canSubmit = form.name.trim().length >= 2 && form.phone.trim().length >= 6 && !submitting;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />
      )}

      <div
        className={`fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            {(step === 'checkout' || step === 'mp-payment') && (
              <button
                onClick={() => {
                  if (step === 'mp-payment') { setStep('checkout'); setMpPreference(null); setMpBrickReady(false); }
                  else setStep('cart');
                }}
                className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-zinc-100 transition-colors mr-1"
                aria-label="Volver"
              >
                <ChevronLeft className="h-5 w-5 text-zinc-600" />
              </button>
            )}
            <ShoppingCart className="h-5 w-5 text-primary-600" />
            <h2 className="font-bold text-lg text-zinc-900">
              {step === 'cart' ? 'Tu pedido'
                : step === 'checkout' ? 'Tus datos'
                : step === 'mp-payment' ? 'Pagar con tarjeta'
                : '¡Pedido confirmado!'}
            </h2>
            {step === 'cart' && items.length > 0 && (
              <span className="text-sm text-zinc-500">({items.length} {items.length === 1 ? 'producto' : 'productos'})</span>
            )}
          </div>
          <button onClick={handleClose} className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-zinc-100 transition-colors" aria-label="Cerrar carrito">
            <X className="h-5 w-5 text-zinc-600" />
          </button>
        </div>

        {/* ── STEP: cart ── */}
        {step === 'cart' && (
          <>
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-zinc-400 px-4">
                  <ShoppingCart className="h-16 w-16 opacity-20" />
                  <p className="font-medium">Tu carrito está vacío</p>
                  <p className="text-sm text-center">Agregá productos desde el catálogo</p>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {items.map(item => {
                    const primaryImage = item.product.images.find(img => img.is_primary) || item.product.images[0];
                    const linePrice = isCard && item.product.installments_3 && item.product.installment_price
                      ? item.product.installment_price * 3
                      : (item.product.price ?? 0);
                    return (
                      <li key={item.id} className="flex gap-3 px-4 py-3">
                        {primaryImage ? (
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-50 border shrink-0">
                            <Image src={resolveImageUrl(primaryImage.url) ?? primaryImage.url} alt={item.product.name} fill className="object-contain" sizes="64px" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-zinc-100 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug">{item.product.name}</p>
                          {item.color && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="w-3 h-3 rounded-full border border-white shadow-sm ring-1 ring-zinc-200 shrink-0" style={{ backgroundColor: item.color }} />
                              {item.colorName && <span className="text-[11px] text-zinc-400">{item.colorName}</span>}
                            </div>
                          )}
                          {isCard && item.product.installments_3 && item.product.installment_price && (
                            <p className="text-[11px] text-teal-600 font-semibold mt-0.5">
                              3 cuotas de {formatPrice(item.product.installment_price)} c/u
                            </p>
                          )}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="flex items-center justify-center w-6 h-6 rounded-full border border-zinc-200 hover:bg-zinc-100 transition-colors" aria-label="Reducir cantidad">
                                <Minus className="h-3 w-3 text-zinc-600" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                              <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="flex items-center justify-center w-6 h-6 rounded-full border border-zinc-200 hover:bg-zinc-100 transition-colors" aria-label="Aumentar cantidad">
                                <Plus className="h-3 w-3 text-zinc-600" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-zinc-800 tabular-nums">{formatPrice(linePrice * item.quantity)}</span>
                              <button onClick={() => removeItem(item.id)} className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-colors text-zinc-300" aria-label="Eliminar producto">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <div className="border-t px-4 py-4 space-y-3 bg-zinc-50 shrink-0">
                {/* Total */}
                <div className="flex items-start justify-between">
                  <span className="text-sm text-zinc-500 mt-1">Total</span>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-zinc-900 tabular-nums">{formatPrice(displayTotal)}</span>
                    {installmentPerPeriod && (
                      <p className="text-xs text-teal-600 font-semibold">3 cuotas de {formatPrice(installmentPerPeriod)}</p>
                    )}
                  </div>
                </div>

                {/* Forma de cobro — solo 2 opciones */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">¿Cómo vas a pagar?</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentFlow(paymentFlow === 'card' ? null : 'card')}
                      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        paymentFlow === 'card'
                          ? 'bg-[#009ee3] border-[#009ee3] text-white shadow-sm'
                          : 'bg-white border-zinc-200 text-zinc-700 hover:border-[#009ee3]/40 hover:bg-[#009ee3]/5'
                      }`}
                    >
                      <Image src="/mercadopago-logo.svg" alt="Mercado Pago" width={72} height={46} className="rounded" />
                      <span className="leading-tight text-center">Mercado Pago</span>
                    </button>
                    <button
                      onClick={() => setPaymentFlow(paymentFlow === 'cash' ? null : 'cash')}
                      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                        paymentFlow === 'cash'
                          ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                          : 'bg-white border-zinc-200 text-zinc-700 hover:border-primary-300 hover:bg-primary-50'
                      }`}
                    >
                      <Banknote className="h-5 w-5" />
                      <span className="leading-tight text-center">Efectivo / Transferencia</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!canGoToCheckout) return;
                    setStep('checkout');
                    trackPublicEvent('initiate_checkout', {
                      value: displayTotal,
                      num_items: items.reduce((s, i) => s + i.quantity, 0),
                    });
                  }}
                  disabled={!canGoToCheckout}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-semibold py-3.5 transition-all disabled:opacity-40"
                >
                  Realizar pedido
                </button>

                {!paymentFlow && items.length > 0 && (
                  <p className="text-center text-[11px] text-zinc-400">Elegí cómo querés pagar para continuar</p>
                )}

                <button onClick={clearCart} className="w-full text-xs text-zinc-400 hover:text-rose-500 transition-colors py-1">
                  Vaciar carrito
                </button>
              </div>
            )}
          </>
        )}

        {/* ── STEP: checkout ── */}
        {step === 'checkout' && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {/* Resumen */}
              <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCard
                    ? <Image src="/mercadopago-logo.svg" alt="Mercado Pago" width={52} height={34} className="rounded" />
                    : <Banknote className="h-4 w-4 text-primary-600" />
                  }
                  <div>
                    <p className="text-xs font-semibold text-zinc-700">
                      {isCard ? 'Mercado Pago' : 'Efectivo / Transferencia'}
                    </p>
                    <p className="text-xs text-zinc-400">{items.length} {items.length === 1 ? 'producto' : 'productos'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold text-zinc-900 tabular-nums">{formatPrice(displayTotal)}</p>
                  {installmentPerPeriod && (
                    <p className="text-[11px] text-teal-600 font-semibold">3 cuotas de {formatPrice(installmentPerPeriod)}</p>
                  )}
                </div>
              </div>

              {/* Formulario */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Nombre <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Tu nombre completo"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Teléfono <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Ej: 11 1234 5678"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                    autoComplete="tel"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Email <span className="text-zinc-400 font-normal">(opcional)</span>
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="tu@email.com"
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Notas <span className="text-zinc-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Dirección, aclaraciones, preferencias..."
                    rows={3}
                    className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </div>

            <div className="border-t px-4 py-4 bg-zinc-50 shrink-0 space-y-2">
              {isCard ? (
                <button
                  onClick={handleGoToMPPayment}
                  disabled={!canSubmit}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#009ee3] hover:bg-[#007fc2] active:scale-[0.98] text-white font-semibold py-3.5 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Preparando pago...</>
                  ) : (
                    'Continuar al pago'
                  )}
                </button>
              ) : (
                <button
                  onClick={handleSubmitOrder}
                  disabled={!canSubmit}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-semibold py-3.5 transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  ) : (
                    'Confirmar pedido'
                  )}
                </button>
              )}
              <p className="text-center text-[11px] text-zinc-400">
                {isCard
                  ? 'Vas a pagar con tarjeta a través de Mercado Pago.'
                  : 'Te contactaremos para coordinar la entrega y el pago.'}
              </p>
            </div>
          </>
        )}

        {/* ── STEP: mp-payment ── */}
        {step === 'mp-payment' && mpPreference && (
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 flex items-center justify-between">
              <p className="text-xs text-zinc-500">{items.length} {items.length === 1 ? 'producto' : 'productos'}</p>
              <p className="text-lg font-extrabold text-zinc-900 tabular-nums">{formatPrice(mpPreference.amount)}</p>
            </div>

            {!mpBrickReady && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-[#009ee3]" />
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-100 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <MercadoPagoPaymentBrick
              publicKey={mpPreference.public_key}
              preferenceId={mpPreference.preference_id}
              amount={mpPreference.amount}
              payerEmail={form.email || undefined}
              onProcessPayment={handleMPProcessPayment}
              onSuccess={(saleId) => {
                setOrderId(saleId ?? null);
                setStep('success');
                trackPublicEvent('purchase', {
                  value: mpPreference.amount,
                  num_items: items.reduce((s, i) => s + i.quantity, 0),
                  content_ids: items.map(i => i.product.id),
                  metadata: { payment_method: 'Tarjeta (MercadoPago)' },
                });
              }}
              onError={(msg) => setError(msg)}
              onReady={() => setMpBrickReady(true)}
            />
          </div>
        )}

        {/* ── STEP: success ── */}
        {step === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 text-center">
            <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-zinc-900">¡Pedido recibido!</h3>
              {orderId && (
                <p className="text-sm text-zinc-500">
                  Pedido <span className="font-bold text-zinc-800">#{orderId}</span>
                </p>
              )}
              <p className="text-sm text-zinc-500 leading-relaxed">
                {isCard
                  ? <>¡Tu pago fue procesado! Te contactaremos al <span className="font-semibold text-zinc-700">{form.phone}</span> para coordinar la entrega.</>
                  : <>Te vamos a contactar al <span className="font-semibold text-zinc-700">{form.phone}</span> para coordinar la entrega y el pago.</>
                }
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-full rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 transition-all"
            >
              Seguir comprando
            </button>
          </div>
        )}
      </div>
    </>
  );
}
