import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Bid } from '../../core/api/models';
import { ClockService } from '../../core/clock.service';
import { formatRelative } from '../../shared/format';
import { MoneyPipe } from '../../shared/pipes';

const COLLAPSED = 6;

@Component({
  selector: 'app-bid-history',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (bids().length === 0) {
      <p class="muted empty">No bids yet — be the first.</p>
    } @else {
      <ol class="history">
        @for (bid of visible(); track bid.id; let first = $first) {
          <li [class.top]="first" [class.mine]="bid.isYou">
            <span class="who">
              {{ bid.isYou ? 'You' : bid.bidderHandle }}
              @if (bid.kind === 'buy_now') {
                <span class="chip chip--cta">Buy Now</span>
              } @else if (first) {
                <span class="chip chip--success">High bid</span>
              }
            </span>
            <span class="amount tabular">{{ bid.amount | money }}</span>
            <time class="when muted" [attr.datetime]="bid.placedAt">{{ relative(bid.placedAt) }}</time>
          </li>
        }
      </ol>
      @if (bids().length > collapsed) {
        <button type="button" class="link-btn toggle" (click)="expanded.set(!expanded())">
          {{ expanded() ? 'Show fewer' : 'Show all ' + bids().length + ' recent bids' }}
        </button>
      }
    }
  `,
  styles: `
    .history {
      display: flex;
      flex-direction: column;
    }
    li {
      display: grid;
      grid-template-columns: 1fr auto;
      grid-template-areas: 'who amount' 'when amount';
      align-items: center;
      gap: 2px var(--space-3);
      padding: var(--space-3) 0;
      border-bottom: 1px solid var(--border);
    }
    li:last-child {
      border-bottom: 0;
    }
    .who {
      grid-area: who;
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-weight: 600;
      font-size: 14.5px;
    }
    .mine .who {
      color: var(--primary);
    }
    .amount {
      grid-area: amount;
      font-weight: 700;
    }
    .top .amount {
      font-size: 17px;
    }
    .when {
      grid-area: when;
      font-size: 13px;
    }
    .toggle {
      margin-top: var(--space-3);
    }
    .empty {
      font-size: 14.5px;
    }
  `,
})
export class BidHistoryComponent {
  readonly bids = input.required<Bid[]>();

  private readonly clock = inject(ClockService);
  protected readonly collapsed = COLLAPSED;
  protected readonly expanded = signal(false);
  protected readonly visible = computed(() => (this.expanded() ? this.bids() : this.bids().slice(0, COLLAPSED)));

  protected relative(iso: string): string {
    return formatRelative(iso, this.clock.now());
  }
}
