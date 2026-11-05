import { computed, inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import {
  InventoryQuery,
  parseInventoryQuery,
  searchKey,
  toSavedParams,
} from '../../features/inventory/inventory-query';
import { AuctionApi } from '../api/auction-api';
import { SavedSearch } from '../api/models';
import { ToastService } from '../toast.service';

/** Mirrors the API's per-buyer limit. */
export const SAVED_SEARCH_LIMIT = 20;

/** The buyer's saved searches, with live-ish match counts (refreshed on each visit to Browse). */
@Injectable({ providedIn: 'root' })
export class SavedSearchesStore {
  private readonly api = inject(AuctionApi);
  private readonly toasts = inject(ToastService);

  readonly items = signal<SavedSearch[]>([]);
  readonly loaded = signal(false);
  readonly count = computed(() => this.items().length);
  /** New matches across every saved search (listed in the last 24 hours). */
  readonly newCount = computed(() => this.items().reduce((total, saved) => total + saved.newCount, 0));

  /** Saved searches by canonical key, to answer "is the current search saved?". */
  private readonly byKey = computed(
    () => new Map(this.items().map((saved) => [searchKey(parseInventoryQuery(saved.query)), saved])),
  );

  start(): void {
    this.refresh();
  }

  refresh(): void {
    this.api.savedSearches().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  find(query: InventoryQuery): SavedSearch | undefined {
    return this.byKey().get(searchKey(query));
  }

  /** Saves (or, for a search that's already saved, renames) — the server keys searches by their criteria. */
  save(name: string, query: InventoryQuery): Observable<SavedSearch> {
    return this.api.saveSearch(name, toSavedParams(query)).pipe(
      tap((saved) =>
        this.items.update((items) =>
          items.some((item) => item.id === saved.id)
            ? items.map((item) => (item.id === saved.id ? saved : item))
            : [saved, ...items],
        ),
      ),
    );
  }

  rename(saved: SavedSearch, name: string): Observable<SavedSearch> {
    return this.save(name, parseInventoryQuery(saved.query));
  }

  /** Optimistic: the search disappears straight away and comes back if the server says no. */
  remove(saved: SavedSearch): void {
    const before = this.items();
    this.items.set(before.filter((item) => item.id !== saved.id));
    this.api.deleteSavedSearch(saved.id).subscribe({
      error: () => {
        this.items.set(before);
        this.toasts.show({ tone: 'danger', title: "Couldn't remove that saved search", message: 'Please try again.' });
      },
    });
  }
}
