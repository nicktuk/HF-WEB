'use client';

import { useEffect, useRef } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import type { IPaymentFormData } from '@mercadopago/sdk-react/esm/bricks/payment/type';

interface MercadoPagoPaymentBrickProps {
  publicKey: string;
  preferenceId: string;
  amount: number;
  payerEmail?: string;
  onSuccess: (saleId?: number, message?: string) => void;
  onError: (errorMessage: string) => void;
  onReady?: () => void;
  onProcessPayment: (formData: unknown) => Promise<{ status: string; sale_id?: number; message: string }>;
}

export default function MercadoPagoPaymentBrick({
  publicKey,
  preferenceId,
  amount,
  payerEmail,
  onSuccess,
  onError,
  onReady,
  onProcessPayment,
}: MercadoPagoPaymentBrickProps) {
  const initializedKey = useRef<string | null>(null);

  useEffect(() => {
    if (initializedKey.current !== publicKey) {
      initMercadoPago(publicKey, { locale: 'es-AR' });
      initializedKey.current = publicKey;
    }
  }, [publicKey]);

  const initialization = {
    amount,
    preferenceId,
    ...(payerEmail ? { payer: { email: payerEmail } } : {}),
  };

  const customization = {
    paymentMethods: {
      ticket: 'all' as const,
      bankTransfer: 'all' as const,
      creditCard: 'all' as const,
      prepaidCard: 'all' as const,
      debitCard: 'all' as const,
      mercadoPago: 'all' as const,
    },
  };

  const handleSubmit = async (data: IPaymentFormData) => {
    try {
      const result = await onProcessPayment(data.formData as unknown);
      if (result.status === 'approved' || result.status === 'pending' || result.status === 'in_process') {
        onSuccess(result.sale_id, result.message);
      } else {
        onError('El pago fue rechazado. Intentá con otra tarjeta o método de pago.');
        throw new Error('rejected');
      }
    } catch (err) {
      const msg = err instanceof Error && err.message !== 'rejected'
        ? err.message
        : 'Error al procesar el pago.';
      if (err instanceof Error && err.message !== 'rejected') {
        onError(msg);
      }
      throw err;
    }
  };

  return (
    <Payment
      initialization={initialization}
      customization={customization}
      onSubmit={handleSubmit}
      onReady={onReady}
      onError={(err) => {
        console.error('MP Brick error:', err);
      }}
    />
  );
}
