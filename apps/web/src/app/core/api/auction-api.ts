import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { InventoryQuery, toApiParams } from '../../features/inventory/inventory-query';
import { ApiError, Facets, SavedSearch, VehicleDetail, VehiclePage, VehicleSummary } from './models';

/** Typed client for the NestJS API. All URLs are relative: dev proxy or same-origin in prod. */
@Injectable({ providedIn: 'root' })
export class AuctionApi {
  private readonly http = inject(HttpClient);

  search(query: InventoryQuery, page: number, pageSize = 24): Observable<VehiclePage> {
    const params = new HttpParams({ fromObject: { ...toApiParams(query), page, pageSize } });
    return this.http.get<VehiclePage>('/api/vehicles', { params });
  }

  /** Filter options, counted against the rest of the buyer's search (or the whole auction). */
  facets(query?: InventoryQuery): Observable<Facets> {
    const params = query ? new HttpParams({ fromObject: toApiParams(query) }) : undefined;
    return this.http.get<Facets>('/api/vehicles/facets', { params });
  }

  vehicle(id: string): Observable<VehicleDetail> {
    return this.http.get<VehicleDetail>(`/api/vehicles/${encodeURIComponent(id)}`);
  }

  placeBid(id: string, amount: number): Observable<VehicleDetail> {
    return this.http.post<VehicleDetail>(`/api/vehicles/${encodeURIComponent(id)}/bids`, { amount });
  }

  buyNow(id: string): Observable<VehicleDetail> {
    return this.http.post<VehicleDetail>(`/api/vehicles/${encodeURIComponent(id)}/buy-now`, {});
  }

  me(): Observable<{ handle: string }> {
    return this.http.get<{ handle: string }>('/api/me');
  }

  myBids(): Observable<VehicleSummary[]> {
    return this.http.get<VehicleSummary[]>('/api/me/bids');
  }

  myWatchlist(): Observable<VehicleSummary[]> {
    return this.http.get<VehicleSummary[]>('/api/me/watchlist');
  }

  watch(id: string): Observable<void> {
    return this.http.put<void>(`/api/me/watchlist/${encodeURIComponent(id)}`, {});
  }

  unwatch(id: string): Observable<void> {
    return this.http.delete<void>(`/api/me/watchlist/${encodeURIComponent(id)}`);
  }

  savedSearches(): Observable<SavedSearch[]> {
    return this.http.get<SavedSearch[]>('/api/me/saved-searches');
  }

  saveSearch(name: string, query: Record<string, string>): Observable<SavedSearch> {
    return this.http.post<SavedSearch>('/api/me/saved-searches', { name, query });
  }

  deleteSavedSearch(id: number): Observable<void> {
    return this.http.delete<void>(`/api/me/saved-searches/${id}`);
  }
}

/** Pulls the API's `{ code, message, details }` body out of an HTTP error. */
export function toApiError(error: unknown): ApiError {
  if (error instanceof HttpErrorResponse && error.error && typeof error.error === 'object' && 'code' in error.error) {
    return error.error as ApiError;
  }
  return {
    code: 'INTERNAL_ERROR',
    message: "We couldn't reach the auction server. Check your connection and try again.",
  };
}
