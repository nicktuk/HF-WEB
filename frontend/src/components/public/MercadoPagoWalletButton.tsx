'use client';

import { useEffect, useRef } from 'react';
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react';

interface MercadoPagoWalletButtonProps {
  publicKey: string;
  preferenceId: string;
  onError: (errorMessage: string) => void;
  onReady?: () => void;
}

export default function MercadoPagoWalletButton({
  publicKey,
  preferenceId,
  onError,
  onReady,
}: MercadoPagoWalletButtonProps) {
  const initializedKey = useRef<string | null>(null);

  useEffect(() => {
    if (initializedKey.current !== publicKey) {
      initMercadoPago(publicKey, { locale: 'es-AR' });
      initializedKey.current = publicKey;
    }
  }, [publicKey]);

  return (
    <Wallet
      initialization={{ preferenceId, redirectMode: 'self' }}
      onReady={onReady}
      onError={(err) => {
        console.error('MP Wallet error:', err);
        onError('No se pudo cargar el botón de pago. Intentá de nuevo.');
      }}
    />
  );
}
