'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShoppingCart, Trash2, Plus, Minus,
  Banknote, ChevronLeft, CheckCircle2, Loader2,
  Truck, MessageCircle, Check,
} from 'lucide-react';
import { PublicHeader } from '@/components/public/PublicHeader';
import { useCart, type CartItem } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';
import { publicApi, resolveImageUrl } from '@/lib/api';
import { trackPublicEvent } from '@/lib/analytics';
import { useCatalogSettings } from '@/hooks/useBadgeLabels';
import { getBuyNowItem, saveBuyNowItem, clearBuyNowItem } from '@/lib/buyNow';

type Step = 'cart' | 'checkout' | 'success';
type PaymentFlow = 'card' | 'cash';
type DeliveryMethod = 'pickup' | 'shipping' | 'agreement';
type ShippingZone = 'amba' | 'resto_pais';

interface CheckoutForm {
  name: string;
  phone: string;
  email: string;
  notes: string;
  shippingStreet: string;
  shippingFloorApt: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostalCode: string;
  shippingReference: string;
}

const PROVINCIAS = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba', 'Corrientes',
  'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones',
  'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe',
  'Santiago del Estero', 'Tierra del Fuego', 'Tucumán',
];

const PHASES = [
  { key: 'cart', label: 'Carrito' },
  { key: 'pago', label: 'Pago' },
  { key: 'success', label: 'Listo' },
] as const;

function phaseOf(step: Step): 'cart' | 'pago' | 'success' {
  if (step === 'cart') return 'cart';
  if (step === 'success') return 'success';
  return 'pago';
}

function Stepper({ step }: { step: Step }) {
  const currentIdx = PHASES.findIndex(p => p.key === phaseOf(step));
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
      {PHASES.map((p, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <div key={p.key} className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-colors ${
                done ? 'bg-emerald-500 text-white' : active ? 'bg-primary-600 text-white' : 'bg-zinc-200 text-zinc-500'
              }`}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className={`text-xs font-semibold ${active ? 'text-zinc-900' : 'text-zinc-400'}`}>{p.label}</span>
            </div>
            {i < PHASES.length - 1 && (
              <div className={`w-8 sm:w-16 h-0.5 rounded-full transition-colors ${done ? 'bg-emerald-500' : 'bg-zinc-200'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionDot({ done }: { done: boolean }) {
  return done ? (
    <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500 shrink-0">
      <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
    </span>
  ) : (
    <span className="w-4 h-4 rounded-full border-2 border-amber-400 shrink-0" />
  );
}

function CarritoPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isBuyNow = searchParams.get('buyNow') === '1';
  const { items: cartItems, removeItem, updateQuantity, clearCart } = useCart();
  const [buyNowItem, setBuyNowItemState] = useState<CartItem | null>(null);
  const { data: catalogSettings } = useCatalogSettings();
  const shippingMinPurchase = catalogSettings?.shipping_min_purchase ?? 0;

  useEffect(() => {
    if (isBuyNow) setBuyNowItemState(getBuyNowItem());
  }, [isBuyNow]);

  const items = isBuyNow ? (buyNowItem ? [buyNowItem] : []) : cartItems;

  function handleQuantityChange(id: string, quantity: number) {
    if (isBuyNow) {
      if (quantity <= 0) {
        clearBuyNowItem();
        setBuyNowItemState(null);
        router.push('/');
        return;
      }
      setBuyNowItemState(prev => {
        if (!prev) return prev;
        const updated = { ...prev, quantity };
        saveBuyNowItem(updated);
        return updated;
      });
    } else {
      updateQuantity(id, quantity);
    }
  }

  function handleRemoveItem(id: string) {
    if (isBuyNow) {
      clearBuyNowItem();
      setBuyNowItemState(null);
      router.push('/');
    } else {
      removeItem(id);
    }
  }

  const [step, setStep] = useState<Step>('cart');
  const [paymentFlow, setPaymentFlow] = useState<PaymentFlow | null>(null);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod | null>(null);
  const [shippingQuote, setShippingQuote] = useState<{ zone: ShippingZone; cost: number } | null>(null);
  const [quotingShipping, setQuotingShipping] = useState(false);
  const [form, setForm] = useState<CheckoutForm>({
    name: '', phone: '', email: '', notes: '',
    shippingStreet: '', shippingFloorApt: '', shippingCity: '', shippingProvince: '', shippingPostalCode: '', shippingReference: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const shippingStreetRef = useRef<HTMLInputElement>(null);
  const shippingCityRef = useRef<HTMLInputElement>(null);
  const shippingProvinceRef = useRef<HTMLSelectElement>(null);
  const shippingPostalCodeRef = useRef<HTMLInputElement>(null);

  const isCard = paymentFlow === 'card';

  function getDeliveryLabel() {
    if (deliveryMethod === 'shipping') {
      return shippingQuote
        ? `Envío a domicilio (${shippingQuote.zone === 'amba' ? 'AMBA' : 'Resto del país'})`
        : 'Envío a domicilio';
    }
    if (deliveryMethod === 'agreement') return 'Envío a coordinar (acuerdo aparte)';
    return 'Retiro sin envío';
  }

  function handleFinish() {
    if (isBuyNow) {
      clearBuyNowItem();
      setBuyNowItemState(null);
    } else {
      clearCart();
    }
    setStep('cart');
    setForm({
      name: '', phone: '', email: '', notes: '',
      shippingStreet: '', shippingFloorApt: '', shippingCity: '', shippingProvince: '', shippingPostalCode: '', shippingReference: '',
    });
    setOrderId(null);
    setDeliveryMethod(null);
    setShippingQuote(null);
    setPaymentFlow(null);
    router.push('/');
  }

  // Cotiza el envío según el código postal ingresado (la clasificación AMBA/resto es server-side).
  useEffect(() => {
    if (deliveryMethod !== 'shipping') {
      setShippingQuote(null);
      return;
    }
    const postalCode = form.shippingPostalCode.trim();
    if (postalCode.length < 4) {
      setShippingQuote(null);
      return;
    }
    setQuotingShipping(true);
    const handle = setTimeout(async () => {
      try {
        const quote = await publicApi.getShippingZone(postalCode);
        setShippingQuote(quote);
      } catch {
        setShippingQuote(null);
      } finally {
        setQuotingShipping(false);
      }
    }, 500);
    return () => { clearTimeout(handle); setQuotingShipping(false); };
  }, [deliveryMethod, form.shippingPostalCode]);

  const displayTotal = useMemo(() =>
    items.reduce((sum, i) => {
      const price = isCard && i.product.installments_3 && i.product.installment_price
        ? i.product.installment_price * 3
        : (i.product.price ?? 0);
      return sum + price * i.quantity;
    }, 0),
    [items, isCard]
  );

  const shippingReady = shippingMinPurchase <= 0 || displayTotal >= shippingMinPurchase;
  const shippingMissing = Math.max(0, shippingMinPurchase - displayTotal);
  const shippingProgressPct = shippingMinPurchase > 0 ? Math.min(100, (displayTotal / shippingMinPurchase) * 100) : 100;
  const canChooseShipping = shippingReady;

  const shippingCost = deliveryMethod === 'shipping' ? (shippingQuote?.cost ?? 0) : 0;
  const grandTotal = displayTotal + shippingCost;

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
    if (!canSubmit) {
      setShowFieldErrors(true);
      setError('Completá los datos marcados en rojo para continuar.');
      focusFirstInvalidField();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const pref = await publicApi.createMPPreference({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        notes: form.notes.trim() || undefined,
        delivery_method: deliveryMethod ?? undefined,
        ...(deliveryMethod === 'shipping' ? {
          shipping_street: form.shippingStreet.trim(),
          shipping_floor_apt: form.shippingFloorApt.trim() || undefined,
          shipping_city: form.shippingCity.trim(),
          shipping_province: form.shippingProvince.trim(),
          shipping_postal_code: form.shippingPostalCode.trim(),
          shipping_reference: form.shippingReference.trim() || undefined,
        } : {}),
        items: items.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          color: i.color ?? undefined,
          is_card_payment: true,
        })),
      });
      // Redirige directo a Mercado Pago, sin pasos intermedios.
      window.location.href = pref.checkout_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago. Intentá de nuevo.');
      setSubmitting(false);
    }
  }

  async function handleSubmitOrder() {
    if (!canSubmit) {
      setShowFieldErrors(true);
      setError('Completá los datos marcados en rojo para continuar.');
      focusFirstInvalidField();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await publicApi.createOrder({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        payment_method: 'Efectivo / Transferencia',
        is_card_payment: false,
        notes: form.notes.trim() || undefined,
        delivery_method: deliveryMethod ?? undefined,
        ...(deliveryMethod === 'shipping' ? {
          shipping_street: form.shippingStreet.trim(),
          shipping_floor_apt: form.shippingFloorApt.trim() || undefined,
          shipping_city: form.shippingCity.trim(),
          shipping_province: form.shippingProvince.trim(),
          shipping_postal_code: form.shippingPostalCode.trim(),
          shipping_reference: form.shippingReference.trim() || undefined,
        } : {}),
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
        value: grandTotal,
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

  const deliveryReady = deliveryMethod !== null;
  const canGoToCheckout = items.length > 0 && paymentFlow !== null && deliveryReady;
  const isShipping = deliveryMethod === 'shipping';
  const nameValid = form.name.trim().length >= 2;
  const phoneValid = form.phone.trim().length >= 6;
  const isValidEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim());
  const streetValid = !isShipping || form.shippingStreet.trim().length > 0;
  const cityValid = !isShipping || form.shippingCity.trim().length > 0;
  const provinceValid = !isShipping || form.shippingProvince.trim().length > 0;
  const postalValid = !isShipping || form.shippingPostalCode.trim().length > 0;
  const canSubmitAddress = streetValid && cityValid && provinceValid && postalValid;
  const canSubmit = nameValid && phoneValid && isValidEmail && canSubmitAddress && !quotingShipping && !submitting;

  function focusFirstInvalidField() {
    const fields: Array<[boolean, React.RefObject<HTMLInputElement | HTMLSelectElement>]> = [
      [nameValid, nameRef],
      [phoneValid, phoneRef],
      [isValidEmail, emailRef],
      ...(isShipping ? [
        [streetValid, shippingStreetRef],
        [cityValid, shippingCityRef],
        [provinceValid, shippingProvinceRef],
        [postalValid, shippingPostalCodeRef],
      ] as Array<[boolean, React.RefObject<HTMLInputElement | HTMLSelectElement>]> : []),
    ];
    const firstInvalid = fields.find(([valid]) => !valid);
    firstInvalid?.[1].current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    firstInvalid?.[1].current?.focus();
  }

  function fieldClass(valid: boolean) {
    return `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-all ${
      showFieldErrors && !valid
        ? 'border-rose-400 ring-2 ring-rose-100 focus:border-rose-400 focus:ring-rose-100'
        : 'border-zinc-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-100'
    }`;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#e0f2fe' }}>
      <PublicHeader />

      <main className={`container mx-auto px-4 py-6 pb-16 ${step === 'checkout' ? 'max-w-7xl' : 'max-w-2xl'}`}>
        <Stepper step={step} />

        {step === 'checkout' ? (
          <div className="lg:grid lg:grid-cols-[1fr_440px] lg:gap-8 lg:items-start">
            {/* ── LEFT: form ── */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setStep('cart')}
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-zinc-100 transition-colors -ml-1 shrink-0"
                  aria-label="Volver"
                >
                  <ChevronLeft className="h-5 w-5 text-zinc-600" />
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-zinc-900">Finalizá tu compra</h1>
              </div>

              {/* Productos */}
              <div className="rounded-2xl bg-white shadow-sm border border-zinc-100 overflow-hidden divide-y divide-zinc-100">
                {items.map(item => {
                  const primaryImage = item.product.images.find(img => img.is_primary) || item.product.images[0];
                  const linePrice = isCard && item.product.installments_3 && item.product.installment_price
                    ? item.product.installment_price * 3
                    : (item.product.price ?? 0);
                  return (
                    <div key={item.id} className="flex gap-4 px-5 sm:px-6 py-4">
                      {primaryImage ? (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-zinc-50 border shrink-0">
                          <Image src={resolveImageUrl(primaryImage.url) ?? primaryImage.url} alt={item.product.name} fill className="object-contain" sizes="80px" />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg bg-zinc-100 shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-base font-semibold text-zinc-900 line-clamp-2 leading-snug">{item.product.name}</p>
                        {item.color && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-3.5 h-3.5 rounded-full border border-white shadow-sm ring-1 ring-zinc-200 shrink-0" style={{ backgroundColor: item.color }} />
                            {item.colorName && <span className="text-xs text-zinc-500">{item.colorName}</span>}
                          </div>
                        )}
                        <p className="text-xs text-zinc-400 mt-1">Cantidad: {item.quantity}</p>
                      </div>
                      <span className="text-sm font-bold text-zinc-800 tabular-nums shrink-0">{formatPrice(linePrice * item.quantity)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Forma de entrega */}
              <div className="rounded-2xl bg-white shadow-sm border border-zinc-100 overflow-hidden p-5 sm:p-6 space-y-3">
                <h2 className="text-lg font-bold text-zinc-900">Forma de entrega</h2>
                <div className="flex gap-2 border-b border-zinc-100">
                  <div className="flex items-center gap-1.5 px-3 pb-2.5 border-b-2 border-primary-600 text-sm font-semibold text-primary-700">
                    {deliveryMethod === 'agreement' ? <MessageCircle className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                    {getDeliveryLabel()}
                  </div>
                </div>

                {deliveryMethod === 'shipping' && (
                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Calle y número <span className="text-rose-500">*</span>
                        </label>
                        <input
                          ref={shippingStreetRef}
                          type="text"
                          value={form.shippingStreet}
                          onChange={e => setForm(f => ({ ...f, shippingStreet: e.target.value }))}
                          placeholder="Av. Siempre Viva 742"
                          className={fieldClass(streetValid)}
                        />
                        {showFieldErrors && !streetValid && (
                          <p className="text-[11px] text-rose-600 mt-1">Requerido.</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Piso/Depto <span className="text-zinc-400 font-normal">(opc.)</span>
                        </label>
                        <input
                          type="text"
                          value={form.shippingFloorApt}
                          onChange={e => setForm(f => ({ ...f, shippingFloorApt: e.target.value }))}
                          placeholder="3° A"
                          className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Localidad <span className="text-rose-500">*</span>
                        </label>
                        <input
                          ref={shippingCityRef}
                          type="text"
                          value={form.shippingCity}
                          onChange={e => setForm(f => ({ ...f, shippingCity: e.target.value }))}
                          placeholder="Ezeiza"
                          className={fieldClass(cityValid)}
                        />
                        {showFieldErrors && !cityValid && (
                          <p className="text-[11px] text-rose-600 mt-1">Requerido.</p>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-700 mb-1">
                          Código Postal <span className="text-rose-500">*</span>
                        </label>
                        <input
                          ref={shippingPostalCodeRef}
                          type="text"
                          value={form.shippingPostalCode}
                          onChange={e => setForm(f => ({ ...f, shippingPostalCode: e.target.value }))}
                          placeholder="1804"
                          className={fieldClass(postalValid)}
                        />
                        {showFieldErrors && !postalValid && (
                          <p className="text-[11px] text-rose-600 mt-1">Requerido.</p>
                        )}
                      </div>
                    </div>

                    {(quotingShipping || shippingQuote) && (
                      <p className="text-[11px] text-zinc-500 px-1">
                        {quotingShipping
                          ? 'Calculando costo de envío...'
                          : shippingQuote && `Zona detectada: ${shippingQuote.zone === 'amba' ? 'AMBA' : 'Resto del país'} — envío ${formatPrice(shippingQuote.cost)}`}
                      </p>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        Provincia <span className="text-rose-500">*</span>
                      </label>
                      <select
                        ref={shippingProvinceRef}
                        value={form.shippingProvince}
                        onChange={e => setForm(f => ({ ...f, shippingProvince: e.target.value }))}
                        className={`${fieldClass(provinceValid)} bg-white`}
                      >
                        <option value="">Elegí una provincia</option>
                        {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                      {showFieldErrors && !provinceValid && (
                        <p className="text-[11px] text-rose-600 mt-1">Requerido.</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 mb-1">
                        Referencia <span className="text-zinc-400 font-normal">(opcional)</span>
                      </label>
                      <input
                        type="text"
                        value={form.shippingReference}
                        onChange={e => setForm(f => ({ ...f, shippingReference: e.target.value }))}
                        placeholder="Portón negro, entre calles..."
                        className="w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                {deliveryMethod === 'agreement' && (
                  <p className="text-xs text-zinc-400 pt-1">Pagás los productos ahora; coordinamos el envío y su costo por WhatsApp.</p>
                )}
              </div>

              {/* Tus datos */}
              <div className="rounded-2xl bg-white shadow-sm border border-zinc-100 overflow-hidden p-5 sm:p-6 space-y-3">
                <h2 className="text-lg font-bold text-zinc-900">Tus datos</h2>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Nombre <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={nameRef}
                    type="text"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Tu nombre completo"
                    className={fieldClass(nameValid)}
                    autoComplete="name"
                  />
                  {showFieldErrors && !nameValid && (
                    <p className="text-[11px] text-rose-600 mt-1">Ingresá tu nombre completo.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Teléfono <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={phoneRef}
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="Ej: 11 1234 5678"
                    className={fieldClass(phoneValid)}
                    autoComplete="tel"
                  />
                  {showFieldErrors && !phoneValid && (
                    <p className="text-[11px] text-rose-600 mt-1">Ingresá un teléfono válido.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={emailRef}
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    placeholder="tu@email.com"
                    className={fieldClass(isValidEmail)}
                    autoComplete="email"
                  />
                  {showFieldErrors && !isValidEmail && (
                    <p className="text-[11px] text-rose-600 mt-1">Ingresá un email válido.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Notas <span className="text-zinc-400 font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Aclaraciones, preferencias..."
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

            {/* ── RIGHT: resumen fijo ── */}
            <aside className="mt-5 lg:mt-0 lg:sticky lg:top-6">
              <div className="rounded-2xl bg-white shadow-sm border border-zinc-100 p-6 space-y-5">
                <h2 className="text-lg font-bold text-zinc-900">Resumen de compra</h2>

                <div className="space-y-3">
                  {items.map(item => {
                    const primaryImage = item.product.images.find(img => img.is_primary) || item.product.images[0];
                    return (
                      <div key={item.id} className="flex items-center gap-3">
                        {primaryImage ? (
                          <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-50 border shrink-0">
                            <Image src={resolveImageUrl(primaryImage.url) ?? primaryImage.url} alt={item.product.name} fill className="object-contain" sizes="64px" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-zinc-100 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 line-clamp-2 leading-snug">{item.product.name}</p>
                          {item.color && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="w-3.5 h-3.5 rounded-full border border-white shadow-sm ring-1 ring-zinc-200 shrink-0" style={{ backgroundColor: item.color }} />
                              {item.colorName && <span className="text-xs text-zinc-500">{item.colorName}</span>}
                            </div>
                          )}
                          <p className="text-xs text-zinc-400 mt-0.5">Cantidad: {item.quantity}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <dl className="space-y-2 text-sm border-t border-zinc-100 pt-4">
                  <div className="flex items-center justify-between">
                    <dt className="text-zinc-500">{items.length === 1 ? 'Producto' : 'Productos'}</dt>
                    <dd className="font-semibold text-zinc-800 tabular-nums">{formatPrice(displayTotal)}</dd>
                  </div>
                  {isShipping && (
                    <div className="flex items-center justify-between">
                      <dt className="text-zinc-500">Envío</dt>
                      <dd className="font-semibold text-zinc-800 tabular-nums">
                        {shippingCost > 0 ? formatPrice(shippingCost) : 'Gratis'}
                      </dd>
                    </div>
                  )}
                  {deliveryMethod === 'agreement' && (
                    <div className="flex items-center justify-between">
                      <dt className="text-zinc-500">Envío</dt>
                      <dd className="text-zinc-400 text-xs">A coordinar</dd>
                    </div>
                  )}
                </dl>

                <div className="border-t border-zinc-100 pt-4 flex items-start justify-between">
                  <span className="text-sm font-semibold text-zinc-700 mt-1">Total</span>
                  <div className="text-right">
                    <span className="text-3xl font-extrabold text-zinc-900 tabular-nums">{formatPrice(grandTotal)}</span>
                    {installmentPerPeriod && (
                      <p className="text-xs text-teal-600 font-semibold">3 cuotas de {formatPrice(installmentPerPeriod)}</p>
                    )}
                  </div>
                </div>

                {isCard ? (
                  <button
                    onClick={handleGoToMPPayment}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#009ee3] hover:bg-[#007fc2] active:scale-[0.98] text-white font-semibold py-3.5 transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Preparando pago...</>
                    ) : (
                      'Pagar y finalizar'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleSubmitOrder}
                    disabled={submitting}
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
            </aside>
          </div>
        ) : (
        <div className="rounded-2xl bg-white shadow-sm border border-zinc-100 overflow-hidden">
          {/* ── Header interno ── */}
          <div className="flex items-center gap-2 px-4 sm:px-6 py-4 border-b">
            <ShoppingCart className="h-5 w-5 text-primary-600" />
            <h1 className="font-bold text-lg text-zinc-900">
              {step === 'cart' ? (isBuyNow ? 'Confirmá tu compra' : 'Tu pedido') : '¡Pedido confirmado!'}
            </h1>
            {step === 'cart' && items.length > 0 && (
              <span className="text-sm text-zinc-500">({items.length} {items.length === 1 ? 'producto' : 'productos'})</span>
            )}
            {step === 'cart' && (
              <Link href="/" className="ml-auto text-xs font-semibold text-zinc-400 hover:text-zinc-600 transition-colors">
                Seguir comprando
              </Link>
            )}
          </div>

          {/* ── STEP: cart ── */}
          {step === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 text-zinc-400 px-4 py-16">
                  <ShoppingCart className="h-16 w-16 opacity-20" />
                  <p className="font-medium">{isBuyNow ? 'No hay ningún producto seleccionado' : 'Tu carrito está vacío'}</p>
                  <Link href="/" className="text-sm text-primary-600 font-semibold hover:underline">
                    Ir al catálogo
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {items.map(item => {
                    const primaryImage = item.product.images.find(img => img.is_primary) || item.product.images[0];
                    const linePrice = isCard && item.product.installments_3 && item.product.installment_price
                      ? item.product.installment_price * 3
                      : (item.product.price ?? 0);
                    return (
                      <li key={item.id} className="flex gap-3 px-4 sm:px-6 py-3">
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
                              <button onClick={() => handleQuantityChange(item.id, item.quantity - 1)} className="flex items-center justify-center w-6 h-6 rounded-full border border-zinc-200 hover:bg-zinc-100 transition-colors" aria-label="Reducir cantidad">
                                <Minus className="h-3 w-3 text-zinc-600" />
                              </button>
                              <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                              <button onClick={() => handleQuantityChange(item.id, item.quantity + 1)} className="flex items-center justify-center w-6 h-6 rounded-full border border-zinc-200 hover:bg-zinc-100 transition-colors" aria-label="Aumentar cantidad">
                                <Plus className="h-3 w-3 text-zinc-600" />
                              </button>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-zinc-800 tabular-nums">{formatPrice(linePrice * item.quantity)}</span>
                              <button onClick={() => handleRemoveItem(item.id)} className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-colors text-zinc-300" aria-label="Eliminar producto">
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

              {items.length > 0 && (
                <div className="border-t px-4 sm:px-6 py-4 space-y-3 bg-zinc-50">
                  {/* Total */}
                  <div className="flex items-start justify-between">
                    <span className="text-sm text-zinc-500 mt-1">Total</span>
                    <div className="text-right">
                      <span className="text-2xl font-extrabold text-zinc-900 tabular-nums">{formatPrice(grandTotal)}</span>
                      {deliveryMethod === 'shipping' && (
                        <p className="text-xs text-zinc-400">
                          {shippingCost > 0
                            ? `Incluye envío ${formatPrice(shippingCost)}`
                            : '+ envío, según tu código postal'}
                        </p>
                      )}
                      {installmentPerPeriod && (
                        <p className="text-xs text-teal-600 font-semibold">3 cuotas de {formatPrice(installmentPerPeriod)}</p>
                      )}
                    </div>
                  </div>

                  {/* Forma de entrega */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <SectionDot done={deliveryReady} />
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">¿Cómo lo recibís?</p>
                    </div>

                    {shippingMinPurchase > 0 && !shippingReady && (
                      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-zinc-600">
                            Te faltan {formatPrice(shippingMissing)} para poder elegir envío
                          </span>
                          <span className="text-zinc-400 tabular-nums shrink-0">{formatPrice(displayTotal)} / {formatPrice(shippingMinPurchase)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary-500 transition-all duration-300"
                            style={{ width: `${shippingProgressPct}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-zinc-400">Mientras tanto podés pedir con &ldquo;Acuerdo de envío&rdquo; y lo coordinamos aparte.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          if (!canChooseShipping) return;
                          setDeliveryMethod(deliveryMethod === 'shipping' ? null : 'shipping');
                        }}
                        disabled={!canChooseShipping}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                          !canChooseShipping
                            ? 'bg-zinc-50 border-zinc-100 text-zinc-300 cursor-not-allowed'
                            : deliveryMethod === 'shipping'
                            ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        <Truck className="h-4 w-4" />
                        <span className="leading-tight text-center">Con envío</span>
                      </button>
                      <button
                        onClick={() => setDeliveryMethod('agreement')}
                        className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border-2 text-xs font-semibold transition-all ${
                          deliveryMethod === 'agreement'
                            ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:border-primary-300 hover:bg-primary-50'
                        }`}
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span className="leading-tight text-center">Acuerdo de envío</span>
                      </button>
                    </div>

                    {deliveryMethod === 'shipping' && (
                      <p className="text-[11px] text-zinc-400 px-1">
                        El costo de envío se calcula según el código postal que cargues en el paso siguiente.
                      </p>
                    )}

                    {deliveryMethod === 'agreement' && (
                      <p className="text-[11px] text-zinc-400 px-1">Pagás los productos ahora; coordinamos el envío y su costo por WhatsApp.</p>
                    )}
                  </div>

                  {/* Forma de cobro — solo 2 opciones */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <SectionDot done={!!paymentFlow} />
                      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">¿Cómo vas a pagar?</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setPaymentFlow(paymentFlow === 'card' ? null : 'card')}
                        className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                          paymentFlow === 'card'
                            ? 'bg-[#009ee3] border-[#009ee3] text-white shadow-sm'
                            : 'bg-white border-zinc-200 text-zinc-700 hover:border-[#009ee3]/40 hover:bg-[#009ee3]/5'
                        }`}
                      >
                        <Image src="/mercadopago-logo.svg" alt="Mercado Pago" width={100} height={64} className="rounded" />
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
                        value: grandTotal,
                        num_items: items.reduce((s, i) => s + i.quantity, 0),
                      });
                    }}
                    disabled={!canGoToCheckout}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-semibold py-3.5 transition-all disabled:opacity-40"
                  >
                    Realizar pedido
                  </button>

                  <button
                    onClick={() => {
                      if (isBuyNow) {
                        clearBuyNowItem();
                        setBuyNowItemState(null);
                        router.push('/');
                      } else {
                        clearCart();
                      }
                    }}
                    className="w-full text-xs text-zinc-400 hover:text-rose-500 transition-colors py-1 border-t border-zinc-200 pt-2"
                  >
                    {isBuyNow ? 'Cancelar compra' : 'Vaciar carrito'}
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── STEP: success ── */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center gap-5 px-6 py-16 text-center">
              <div className="flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-zinc-900">¡Pedido recibido!</h2>
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
                onClick={handleFinish}
                className="w-full max-w-xs rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3.5 transition-all"
              >
                Seguir comprando
              </button>
            </div>
          )}
        </div>
        )}
      </main>
    </div>
  );
}

export default function CarritoPage() {
  return (
    <Suspense fallback={null}>
      <CarritoPageContent />
    </Suspense>
  );
}
