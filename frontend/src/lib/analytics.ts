'use client';

import { publicApi } from '@/lib/api';

export type PublicEventName =
  | 'page_view'
  | 'search'
  | 'category_click'
  | 'subcategory_click'
  | 'product_click'
  | 'whatsapp_click'
  | 'initiate_checkout'
  | 'purchase';

type PublicEventPayload = {
  category?: string;
  subcategory?: string;
  product_id?: number;
  product_slug?: string;
  search_query?: string;
  value?: number;
  num_items?: number;
  content_ids?: number[];
  metadata?: Record<string, unknown>;
};

type ExternalWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
};

const SESSION_KEY = 'hf_public_session_id';

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  window.localStorage.setItem(SESSION_KEY, generated);
  return generated;
}

function fireExternalEvents(eventName: PublicEventName, payload: PublicEventPayload): void {
  const { gtag, fbq } = window as ExternalWindow;

  if (eventName === 'page_view' && payload.product_id) {
    gtag?.('event', 'view_item', {
      items: [{ item_id: String(payload.product_id), item_name: payload.product_slug }],
    });
    fbq?.('track', 'ViewContent', {
      content_ids: [String(payload.product_id)],
      content_type: 'product',
    });
  }

  if (eventName === 'search' && payload.search_query) {
    gtag?.('event', 'search', { search_term: payload.search_query });
    fbq?.('track', 'Search', { search_string: payload.search_query });
  }

  if (eventName === 'whatsapp_click') {
    fbq?.('track', 'Contact');
    gtag?.('event', 'generate_lead', { method: 'whatsapp' });
  }

  if (eventName === 'initiate_checkout') {
    fbq?.('track', 'InitiateCheckout', {
      value: payload.value,
      currency: 'ARS',
      num_items: payload.num_items,
    });
    gtag?.('event', 'begin_checkout', { value: payload.value, currency: 'ARS' });
  }

  if (eventName === 'purchase') {
    fbq?.('track', 'Purchase', {
      value: payload.value,
      currency: 'ARS',
      content_ids: payload.content_ids?.map(String),
      content_type: 'product',
    });
    gtag?.('event', 'purchase', { value: payload.value, currency: 'ARS' });
  }
}

export function trackPublicEvent(eventName: PublicEventName, payload: PublicEventPayload = {}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const eventPayload = {
    event_name: eventName,
    session_id: getOrCreateSessionId(),
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || undefined,
    ...payload,
  };

  fireExternalEvents(eventName, payload);

  publicApi.trackEvent(eventPayload).catch(() => {
    // Tracking must never affect UX.
  });
}
