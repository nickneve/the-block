import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { WatchlistStore } from '../../core/state/watchlist.store';
import { IconComponent } from './icon.component';

@Component({
  selector: 'app-watch-button',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="watch"
      [class.watch--overlay]="variant() === 'overlay'"
      [class.watch--labelled]="variant() === 'labelled'"
      [class.watch--ghost]="variant() === 'ghost'"
      [attr.aria-pressed]="watched()"
      [attr.aria-label]="variant() === 'labelled' ? null : (watched() ? 'Remove from watchlist' : 'Add to watchlist')"
      (click)="toggle($event)"
    >
      <svg appIcon="star" [size]="18" [strokeWidth]="2.2"></svg>
      @if (variant() === 'labelled') {
        <span>{{ watched() ? 'Watching' : 'Watch' }}</span>
      }
    </button>
  `,
  styles: `
    .watch {
      display: inline-grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border: 1px solid var(--border);
      border-radius: var(--radius-pill);
      background: var(--surface);
      color: var(--text-muted);
      transition: color 0.15s var(--ease), background-color 0.15s var(--ease), transform 0.15s var(--ease);
    }
    .watch:hover {
      color: var(--text);
    }
    .watch:active {
      transform: scale(0.94);
    }
    .watch[aria-pressed='true'] {
      color: var(--star);
    }
    .watch[aria-pressed='true'] svg {
      fill: currentColor;
    }
    .watch--overlay {
      border-color: transparent;
      background: var(--overlay-chip);
      color: #fff;
      backdrop-filter: blur(6px);
    }
    .watch--overlay:hover {
      color: #fff;
    }
    .watch--ghost {
      width: 36px;
      height: 36px;
      border-color: transparent;
      background: transparent;
      color: var(--text-subtle);
    }
    .watch--ghost:hover {
      background: var(--surface-muted);
    }
    .watch--labelled {
      display: inline-flex;
      gap: 8px;
      width: auto;
      height: 40px;
      padding: 0 14px;
      font-size: 14px;
      font-weight: 600;
    }
    .watch--labelled[aria-pressed='true'] {
      color: var(--text);
    }
    .watch--labelled[aria-pressed='true'] svg {
      color: var(--star);
    }
  `,
})
export class WatchButtonComponent {
  readonly vehicleId = input.required<string>();
  readonly variant = input<'overlay' | 'plain' | 'ghost' | 'labelled'>('plain');

  private readonly watchlist = inject(WatchlistStore);
  protected readonly watched = computed(() => this.watchlist.ids().has(this.vehicleId()));

  protected toggle(event: Event): void {
    // Cards are links; don't navigate when starring.
    event.preventDefault();
    event.stopPropagation();
    this.watchlist.toggle(this.vehicleId());
  }
}
