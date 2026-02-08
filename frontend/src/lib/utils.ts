import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format price for display
 */
export function formatPrice(price: number | null | undefined, currency = 'ARS'): string {
  if (price == null) return 'Consultar';

  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number | null | undefined): string {
  if (value == null) return '-';

  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return '-';

  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric.toFixed(1)}%`;
}

/**
 * Format date for display
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

/**
 * Format relative time (e.g., "hace 2 horas")
 */
export function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'hace un momento';
  if (diffMins < 60) return `hace ${diffMins} minutos`;
  if (diffHours < 24) return `hace ${diffHours} horas`;
  if (diffDays < 7) return `hace ${diffDays} días`;

  return formatDate(dateString);
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Generate WhatsApp URL
 */
export function getWhatsAppUrl(phone: string, message: string): string {
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encodedMessage}`;
}

/**
 * Get competitiveness color
 */
export function getCompetitivenessColor(competitiveness: string): string {
  switch (competitiveness) {
    case 'competitive':
    case 'below_market':
      return 'text-green-600';
    case 'moderate':
      return 'text-yellow-600';
    case 'high':
      return 'text-orange-600';
    case 'very_high':
      return 'text-red-600';
    default:
      return 'text-gray-500';
  }
}

/**
 * Get competitiveness label
 */
export function getCompetitivenessLabel(competitiveness: string): string {
  switch (competitiveness) {
    case 'competitive':
      return 'Competitivo';
    case 'below_market':
      return 'Por debajo del mercado';
    case 'moderate':
      return 'Moderado';
    case 'high':
      return 'Alto';
    case 'very_high':
      return 'Muy alto';
    default:
      return 'Sin datos';
  }
}
