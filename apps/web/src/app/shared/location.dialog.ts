import { DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { catchError, debounceTime, distinctUntilChanged, firstValueFrom, map, of, switchMap, tap } from 'rxjs';
import { BuyerLocationService } from '../core/location.service';
import { Place, PlaceSearch } from '../core/place-search';
import { IconComponent } from './ui/icon.component';

type SearchStatus = 'idle' | 'searching' | 'done' | 'error';

/** Searching starts once there's enough to go on ("Buf", "N2G"). */
const MIN_QUERY = 3;

/**
 * Sets where the buyer is, for distances and "Closest to me": wherever they
 * really are — their device's position, or any city, address or postal/ZIP
 * code in Canada or the US. Resolves true when a location was set.
 */
@Component({
  selector: 'app-location-dialog',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-dialog' },
  template: `
    <header class="head">
      <h2>Where are you buying from?</h2>
      <button type="button" class="icon-btn" aria-label="Close" (click)="close(false)">
        <svg appIcon="x" [size]="20"></svg>
      </button>
    </header>

    <div class="content">
      <p class="muted">
        We'll show how far away each vehicle is and can sort lots by distance — handy for pickup and transport costs.
        Your location stays in this browser, rounded to about 1 km.
      </p>

      <button type="button" class="btn btn--primary btn--block" [disabled]="locating()" (click)="useDevice()">
        @if (locating()) {
          <svg appIcon="loader-circle" [size]="18" class="spin"></svg>
          Finding you…
        } @else {
          <svg appIcon="locate-fixed" [size]="18"></svg>
          Use my current location
        }
      </button>
      @if (deviceError()) {
        <p class="error" role="alert">{{ deviceError() }}</p>
      }

      <div class="divider"><span>or search</span></div>

      <div class="search">
        <label class="sr-only" for="place-search">City, address or postal code</label>
        <div class="search-field">
          <svg appIcon="search" [size]="18"></svg>
          <input
            id="place-search"
            type="search"
            class="input"
            placeholder="City, address or postal/ZIP code"
            autocomplete="off"
            spellcheck="false"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="place-results"
            [attr.aria-expanded]="results().length > 0"
            [attr.aria-activedescendant]="results().length ? 'place-' + active() : null"
            (input)="text.set($any($event.target).value)"
            (keydown.arrowdown)="move(1, $event)"
            (keydown.arrowup)="move(-1, $event)"
            (keydown.enter)="chooseActive($event)"
          />
          @if (status() === 'searching') {
            <svg appIcon="loader-circle" [size]="16" class="spin field-spinner" aria-hidden="true"></svg>
          }
        </div>

        <ul id="place-results" class="results" role="listbox" aria-label="Matching places" [hidden]="!results().length">
          @for (place of results(); track place.label; let i = $index) {
            <li
              role="option"
              class="result"
              [id]="'place-' + i"
              [class.active]="i === active()"
              [attr.aria-selected]="i === active()"
              (mouseenter)="active.set(i)"
              (click)="choose(place)"
            >
              <svg appIcon="map-pin" [size]="16"></svg>
              <span class="result-text">
                <span class="result-label">{{ place.label }}</span>
                <span class="result-detail">{{ place.detail }}</span>
              </span>
            </li>
          }
        </ul>

        <p class="hint" [class.error]="status() === 'error'" aria-live="polite">
          @switch (hint()) {
            @case ('empty') {
              No places match that. Try a city name or a postal/ZIP code.
            }
            @case ('error') {
              We couldn't search places just now. Check your connection, or use your current location.
            }
            @default {
              Anywhere in Canada or the US. Place search by
              <a href="https://photon.komoot.io" target="_blank" rel="noopener">Photon</a>, map data ©
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>
              contributors.
            }
          }
        </p>
      </div>
    </div>

    @if (current(); as current) {
      <footer class="foot">
        <span class="current">
          <svg appIcon="map-pin" [size]="15"></svg>
          Currently: <strong>{{ current.label }}</strong>
        </span>
        <button type="button" class="link-btn" (click)="clear()">Forget my location</button>
      </footer>
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-4) 0 var(--space-5);
    }
    h2 {
      font-size: 20px;
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-3) var(--space-5) var(--space-5);
    }
    .error {
      color: var(--danger);
      font-size: 14px;
    }
    .divider {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      color: var(--text-subtle);
      font-size: 13px;
    }
    .divider::before,
    .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--border);
    }
    .search {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .search-field {
      position: relative;
      display: flex;
      align-items: center;

      > svg:first-child {
        position: absolute;
        left: 14px;
        color: var(--text-subtle);
        pointer-events: none;
      }
      .input {
        padding-left: 42px;
        padding-right: 40px;
      }
    }
    .field-spinner {
      position: absolute;
      right: 14px;
      color: var(--text-subtle);
    }
    .results {
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      background: var(--surface);
    }
    .result {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: var(--space-3);
      min-height: 52px;
      padding: var(--space-2) var(--space-3);
      cursor: pointer;
      font-size: 14.5px;

      & + & {
        border-top: 1px solid var(--border);
      }
      svg {
        color: var(--text-subtle);
      }
      &.active {
        background: var(--primary-soft);

        svg {
          color: var(--primary);
        }
      }
    }
    /* Label over country, so a full street address never gets cut off on a phone. */
    .result-text {
      display: flex;
      flex-direction: column;
      min-width: 0;
      line-height: 1.3;
    }
    .result-label {
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .result-detail {
      color: var(--text-subtle);
      font-size: 12.5px;
    }
    .hint {
      color: var(--text-subtle);
      font-size: 13px;
      line-height: 1.5;

      a {
        color: inherit;
        text-decoration: underline;
      }
      &.error {
        color: var(--danger);
      }
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-top: 1px solid var(--border);
      font-size: 14px;
    }
    .current {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      color: var(--text-muted);
    }
    .current strong {
      color: var(--text);
    }
    .spin {
      animation: spin 0.9s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class LocationDialog {
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly locationService = inject(BuyerLocationService);
  private readonly places = inject(PlaceSearch);

  protected readonly current = this.locationService.location;
  protected readonly locating = signal(false);
  protected readonly deviceError = signal<string | null>(null);

  protected readonly text = signal('');
  protected readonly status = signal<SearchStatus>('idle');
  protected readonly results = signal<Place[]>([]);
  protected readonly active = signal(0);
  /** Which message sits under the search box. */
  protected readonly hint = signal<'about' | 'empty' | 'error'>('about');

  constructor() {
    toObservable(this.text)
      .pipe(
        map((text) => text.trim()),
        debounceTime(250),
        distinctUntilChanged(),
        tap((text) => this.status.set(text.length >= MIN_QUERY ? 'searching' : 'idle')),
        switchMap((text) =>
          text.length < MIN_QUERY
            ? of<Place[] | null>([])
            : this.places.search(text).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((places) => {
        const searched = this.status() === 'searching';
        this.results.set(places ?? []);
        this.active.set(0);
        this.status.set(places === null ? 'error' : searched ? 'done' : 'idle');
        this.hint.set(places === null ? 'error' : searched && places.length === 0 ? 'empty' : 'about');
      });
  }

  protected async useDevice(): Promise<void> {
    this.locating.set(true);
    this.deviceError.set(null);
    const point = await this.locationService.detect();

    if (!point) {
      this.locating.set(false);
      this.deviceError.set("We couldn't get your location (it may be blocked in your browser). Search for your city instead.");
      return;
    }
    // Name the town if the lookup works; the position alone is all distances need.
    const town = await firstValueFrom(this.places.townAt(point)).catch(() => null);
    this.locating.set(false);
    this.locationService.set({ ...point, label: town?.label || 'Your current location', source: 'device' });
    this.close(true);
  }

  protected move(step: number, event: Event): void {
    const count = this.results().length;
    if (!count) return;
    event.preventDefault();
    this.active.set((this.active() + step + count) % count);
  }

  protected chooseActive(event: Event): void {
    const place = this.results()[this.active()];
    if (!place) return;
    event.preventDefault();
    this.choose(place);
  }

  protected choose(place: Place): void {
    this.locationService.set({ lat: place.lat, lng: place.lng, label: place.label, source: 'search' });
    this.close(true);
  }

  protected clear(): void {
    this.locationService.clear();
    this.close(false);
  }

  protected close(changed: boolean): void {
    this.dialogRef.close(changed);
  }
}
