import { HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'the-block.bidder-id';

/**
 * Anonymous buyer identity (no accounts in this prototype). A random id is
 * created once per browser and sent with every API call; the server derives a
 * public handle from it. A private window therefore acts as a second buyer.
 */
@Injectable({ providedIn: 'root' })
export class BidderService {
  readonly id = loadOrCreateId();
  /** Public handle, e.g. "Bidder 4821" — set once /api/me responds. */
  readonly handle = signal<string | null>(null);
}

export const bidderIdInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const bidder = inject(BidderService);
  return next(request.clone({ setHeaders: { 'X-Bidder-Id': bidder.id } }));
};

function loadOrCreateId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const created = randomId();
    localStorage.setItem(STORAGE_KEY, created);
    return created;
  } catch {
    // Storage blocked (e.g. strict privacy mode): fall back to a per-tab identity.
    return randomId();
  }
}

/** crypto.randomUUID() needs a secure context; a phone hitting the dev server over LAN isn't one. */
function randomId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
