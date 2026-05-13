'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { X, ShoppingCart, Trash2, Plus, Minus, MessageCircle } from 'lucide-react';
import { useCart, type CartItem } from '@/context/CartContext';
import { formatPrice, getWhatsAppUrl } from '@/lib/utils';
import { resolveImageUrl } from '@/lib/api';
import { trackPublicEvent } from '@/lib/analytics';

function buildCartMessage(items: CartItem[]): string {
  const lines = ['Hola! Quiero hacer el siguiente pedido:', ''];

  for (const item of items) {
    const colorPart = item.color ? ` (color: ${item.color})` : '';
    const pricePart = item.product.price ? ` — ${formatPrice(item.product.price)} c/u` : '';
    lines.push(`• ${item.quantity}x ${item.product.name}${colorPart}${pricePart}`);
  }

  const total = items.reduce((sum, i) => sum + (i.product.price ?? 0) * i.quantity, 0);
  lines.push('');
  lines.push(`*Total estimado: ${formatPrice(total)}*`);
  lines.push('');
  lines.push('Por favor confirmame disponibilidad y forma de pago. ¡Gracias!');

  return lines.join('\n');
}

export function CartDrawer() {
  const { items, removeItem, updateQuantity, clearCart, totalPrice, isOpen, closeCart } = useCart();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCart(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeCart]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '';
  const whatsappUrl = getWhatsAppUrl(whatsappNumber, buildCartMessage(items));

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          onClick={closeCart}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed right-0 top-0 bottom-0 z-50 flex flex-col w-full max-w-sm bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito de compras"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary-600" />
            <h2 className="font-bold text-lg text-zinc-900">Tu pedido</h2>
            {items.length > 0 && (
              <span className="text-sm text-zinc-500">
                ({items.length} {items.length === 1 ? 'producto' : 'productos'})
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-zinc-100 transition-colors"
            aria-label="Cerrar carrito"
          >
            <X className="h-5 w-5 text-zinc-600" />
          </button>
        </div>

        {/* Items */}
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
                const primaryImage =
                  item.product.images.find(img => img.is_primary) || item.product.images[0];
                const lineTotal = (item.product.price ?? 0) * item.quantity;
                return (
                  <li key={item.id} className="flex gap-3 px-4 py-3">
                    {primaryImage ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-zinc-50 border shrink-0">
                        <Image
                          src={resolveImageUrl(primaryImage.url) ?? primaryImage.url}
                          alt={item.product.name}
                          fill
                          className="object-contain"
                          sizes="64px"
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-zinc-100 shrink-0" />
                    )}

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 line-clamp-2 leading-snug">
                        {item.product.name}
                      </p>
                      {item.color && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="w-3 h-3 rounded-full border border-white shadow-sm ring-1 ring-zinc-200 shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[11px] text-zinc-400">{item.color}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2">
                        {/* Quantity controls */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            className="flex items-center justify-center w-6 h-6 rounded-full border border-zinc-200 hover:bg-zinc-100 transition-colors"
                            aria-label="Reducir cantidad"
                          >
                            <Minus className="h-3 w-3 text-zinc-600" />
                          </button>
                          <span className="w-6 text-center text-sm font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="flex items-center justify-center w-6 h-6 rounded-full border border-zinc-200 hover:bg-zinc-100 transition-colors"
                            aria-label="Aumentar cantidad"
                          >
                            <Plus className="h-3 w-3 text-zinc-600" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-zinc-800 tabular-nums">
                            {formatPrice(lineTotal)}
                          </span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-rose-50 hover:text-rose-500 transition-colors text-zinc-300"
                            aria-label="Eliminar producto"
                          >
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

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t px-4 py-4 space-y-3 bg-zinc-50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-500">Total estimado</span>
              <span className="text-2xl font-extrabold text-zinc-900 tabular-nums">
                {formatPrice(totalPrice)}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 -mt-1">
              Los precios pueden variar según disponibilidad del proveedor.
            </p>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() =>
                trackPublicEvent('whatsapp_click', {
                  metadata: {
                    origin: 'cart_checkout',
                    items_count: items.length,
                    total: totalPrice,
                  },
                })
              }
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-600 hover:bg-green-700 active:scale-[0.98] text-white font-semibold py-3.5 transition-all"
            >
              <MessageCircle className="h-5 w-5" />
              Confirmar pedido por WhatsApp
            </a>

            <button
              onClick={clearCart}
              className="w-full text-xs text-zinc-400 hover:text-rose-500 transition-colors py-1"
            >
              Vaciar carrito
            </button>
          </div>
        )}
      </div>
    </>
  );
}
