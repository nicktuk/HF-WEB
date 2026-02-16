'use client';

import { publicApi } from '@/lib/api';

export type PublicEventName =
  | 'page_view'
  | 'search'
  | 'category_click'
  | 'subcategory_click'
  | 'product_click'
  | 'whatsapp_click';

type PublicEventPayload = {
  category?: string;
  subcategory?: string;
  product_id?: number;
  product_slug?: string;
  search_query?: string;
  metadata?: Record<string, unknown>;
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

  publicApi.trackEvent(eventPayload).catch(() => {
    // Tracking must never affect UX.
  });
}
