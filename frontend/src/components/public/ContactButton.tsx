'use client';

import { MessageCircle, Mail } from 'lucide-react';
import { getWhatsAppUrl, cn } from '@/lib/utils';

interface ContactButtonProps {
  productName: string;
  variant?: 'whatsapp' | 'email';
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
  variant = 'whatsapp',
  size = 'md',
  className,
}: ContactButtonProps) {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const email = process.env.NEXT_PUBLIC_EMAIL || '';

  if (variant === 'whatsapp') {
    const message = `Hola! Me interesa el producto: ${productName}`;
    const url = getWhatsAppUrl(whatsappNumber, message);

    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
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

  const subject = encodeURIComponent(`Consulta: ${productName}`);
  const body = encodeURIComponent(`Hola, me interesa el producto: ${productName}`);
  const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;

  return (
    <a
      href={mailtoUrl}
      className={cn(
        baseStyles,
        sizes[size],
        'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:ring-primary-500',
        className
      )}
    >
      <Mail className="mr-2 h-5 w-5" />
      Consultar por Email
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
      className="fixed bottom-4 right-4 z-40 md:hidden bg-green-500 text-white p-4 rounded-full shadow-lg hover:bg-green-600 transition-colors"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  );
}
