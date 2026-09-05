import type { CartItem } from '@/context/CartContext';
import type { ProductPublic } from '@/types';

const STORAGE_KEY = 'hefa-buy-now';

export function setBuyNowItem(
  product: ProductPublic,
  quantity: number,
  color?: string | null,
  colorName?: string | null,
): void {
  const item: CartItem = {
    id: `buy-now-${product.id}-${color ?? 'none'}`,
    product,
    quantity,
    color,
    colorName,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(item));
  } catch {}
}

export function saveBuyNowItem(item: CartItem): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(item));
  } catch {}
}

export function getBuyNowItem(): CartItem | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearBuyNowItem(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}
