'use client';

import { MessageCircle } from 'lucide-react';
import { getWhatsAppUrl, cn } from '@/lib/utils';
import { trackPublicEvent } from '@/lib/analytics';

interface ContactButtonProps {
  productName: string;
  productSlug?: string;
  productPrice?: number | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function ContactButton({
  productName,
  productSlug,
  productPrice,
  size = 'md',
  className,
}: ContactButtonProps) {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const productUrl = productSlug ? `${siteUrl}/producto/${productSlug}` : undefined;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      minimumFractionDigits: 0,
    }).format(price);
  };

  let message = `Hola! Me interesa el producto: ${productName}`;
  if (productPrice) {
    message += `\nPrecio: ${formatPrice(productPrice)}`;
  }
  if (productUrl) {
    message += `\n${productUrl}`;
  }
  const url = getWhatsAppUrl(whatsappNumber, message);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackPublicEvent('whatsapp_click', {
          product_slug: productSlug,
          metadata: {
            origin: 'product_contact_button',
            product_name: productName,
            product_price: productPrice ?? null,
          },
        });
      }}
      className={cn(
        baseStyles,
        sizes[size],
        'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
        className
      )}
    >
      <MessageCircle className="mr-2 h-5 w-5" />
      Consultar por WhatsApp
    </a>
  );
}

// Floating WhatsApp button for mobile
export function FloatingWhatsAppButton() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const url = getWhatsAppUrl(whatsappNumber, 'Hola! Tengo una consulta');

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        trackPublicEvent('whatsapp_click', {
          metadata: { origin: 'floating_whatsapp_button' },
        });
      }}
      className="fixed bottom-4 right-4 z-40 md:hidden bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-colors"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
