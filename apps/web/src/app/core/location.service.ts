import { HttpInterceptorFn } from '@angular/common/http';
import { effect, inject, Injectable, signal } from '@angular/core';
import { GeoPoint, roundCoordinate } from '../shared/geo';

export interface BuyerLocation extends GeoPoint {
  /** e.g. "Buffalo, NY" or "N2G 4G7, Kitchener, ON". */
  label: string;
  /** The device's position, or a place the buyer searched for. */
  source: 'device' | 'search';
}

const STORAGE_KEY = 'the-block.location';

/**
 * Where the buyer is, for "Closest to me" and distances on every lot.
 * Opt-in only, rounded to ~1 km, kept in this browser, and sent to the API in
 * a header so it never ends up in a shareable URL or a saved search.
 */
@Injectable({ providedIn: 'root' })
export class BuyerLocationService {
  readonly location = signal<BuyerLocation | null>(load());

  constructor() {
    effect(() => persist(this.location()));
  }

  set(location: BuyerLocation): void {
    this.location.set({ ...location, lat: roundCoordinate(location.lat), lng: roundCoordinate(location.lng) });
  }

  clear(): void {
    this.location.set(null);
  }

  /** Asks the browser for the device position. Resolves null if refused, unavailable or too slow. */
  detect(): Promise<GeoPoint | null> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60 * 60 * 1000 },
      );
    });
  }
}

export const buyerLocationInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const location = inject(BuyerLocationService).location();
  if (!location) return next(request);
  return next(request.clone({ setHeaders: { 'X-Buyer-Location': `${location.lat},${location.lng}` } }));
};

function load(): BuyerLocation | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<BuyerLocation> | null;
    if (parsed && typeof parsed.lat === 'number' && typeof parsed.lng === 'number' && typeof parsed.label === 'string') {
      return { lat: parsed.lat, lng: parsed.lng, label: parsed.label, source: parsed.source === 'device' ? 'device' : 'search' };
    }
  } catch {
    // Unreadable or blocked storage: start without a location.
  }
  return null;
}

function persist(location: BuyerLocation | null): void {
  try {
    if (location) localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the location just won't survive a reload.
  }
}
