import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { formatMoney } from '../../shared/format';
import { MoneyPipe } from '../../shared/pipes';
import { IconComponent } from '../../shared/ui/icon.component';

export interface ConfirmBidData {
  kind: 'bid' | 'buy_now';
  vehicleName: string;
  lot: string;
  amount: number;
  minNextBid: number;
  buyNowPrice: number | null;
  titleStatus: string;
}

/**
 * The last checkpoint before a binding commitment. It restates exactly what
 * the buyer is agreeing to and calls out anything they might have missed.
 */
@Component({
  selector: 'app-confirm-bid-dialog',
  imports: [MoneyPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-dialog' },
  template: `
    @let d = data;
    <header class="head">
      <h2 id="confirm-bid-title">{{ d.kind === 'bid' ? 'Confirm your bid' : 'Buy it now?' }}</h2>
      <button type="button" class="icon-btn" aria-label="Cancel" (click)="close(false)">
        <svg appIcon="x" [size]="20"></svg>
      </button>
    </header>

    <div class="content">
      <p class="vehicle">{{ d.vehicleName }} <span class="muted">· Lot {{ d.lot }}</span></p>

      <div class="amount-box">
        <span class="eyebrow">{{ d.kind === 'bid' ? 'Your bid' : 'Buy Now price' }}</span>
        <span class="amount tabular">{{ d.amount | money }}</span>
      </div>

      @if (notes.length) {
        <ul class="notes">
          @for (note of notes; track note.text) {
            <li [attr.data-tone]="note.tone">
              @if (note.tone === 'info') {
                <svg appIcon="info" [size]="16" [strokeWidth]="2.2"></svg>
              } @else {
                <svg appIcon="triangle-exclamation-point" [size]="16" [strokeWidth]="2.2"></svg>
              }
              <span>{{ note.text }}</span>
            </li>
          }
        </ul>
      }

      <p class="fine">
        @if (d.kind === 'bid') {
          Bids are binding. If you're the high bidder when the auction closes and the reserve is met, you agree to buy
          this vehicle at your bid.
        } @else {
          This purchase is binding and ends the auction immediately.
        }
      </p>
    </div>

    <footer class="foot">
      <button type="button" class="btn btn--secondary" (click)="close(false)">Cancel</button>
      <button type="button" class="btn btn--cta" cdkFocusInitial (click)="close(true)">
        {{ d.kind === 'bid' ? 'Place bid' : 'Buy now' }} · {{ d.amount | money }}
      </button>
    </footer>
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
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
    .vehicle {
      font-weight: 600;
    }
    .amount-box {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: var(--space-4);
      border-radius: var(--radius-md);
      background: var(--cta-soft);
    }
    .amount {
      color: var(--text);
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .notes {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .notes li {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
      padding: var(--space-3);
      border-radius: var(--radius-sm);
      background: var(--surface-muted);
      font-size: 14px;
    }
    .notes li svg {
      margin-top: 2px;
    }
    .notes li[data-tone='warning'] {
      background: var(--warning-soft);
    }
    .notes li[data-tone='warning'] svg {
      color: var(--warning);
    }
    .notes li[data-tone='danger'] {
      background: var(--danger-soft);
    }
    .notes li[data-tone='danger'] svg {
      color: var(--danger);
    }
    .notes li[data-tone='info'] svg {
      color: var(--primary);
    }
    .fine {
      color: var(--text-muted);
      font-size: 13.5px;
    }
    .foot {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-5);
      border-top: 1px solid var(--border);
    }
    @media (max-width: 480px) {
      .foot {
        flex-direction: column-reverse;
      }
      .foot .btn {
        width: 100%;
      }
    }
  `,
})
export class ConfirmBidDialog {
  protected readonly data = inject<ConfirmBidData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);

  protected readonly notes = confirmationNotes(this.data);

  protected close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }
}

interface ConfirmationNote {
  tone: 'info' | 'warning' | 'danger';
  text: string;
}

/** Things a careful buyer would want pointed out before committing. */
export function confirmationNotes(data: ConfirmBidData): ConfirmationNote[] {
  const { kind, amount, minNextBid, buyNowPrice, titleStatus } = data;
  const notes: ConfirmationNote[] = [];

  if (kind === 'bid' && amount > minNextBid) {
    const over = amount - minNextBid;
    notes.push({
      tone: over > minNextBid * 0.1 ? 'warning' : 'info',
      text: `This is ${formatMoney(over)} above the minimum bid of ${formatMoney(minNextBid)}.`,
    });
  }
  if (kind === 'bid' && buyNowPrice !== null && amount >= buyNowPrice) {
    notes.push({ tone: 'warning', text: `Buy Now is ${formatMoney(buyNowPrice)} — you could buy it outright for less.` });
  }
  if (titleStatus === 'salvage' || titleStatus === 'rebuilt') {
    notes.push({ tone: 'danger', text: `This vehicle has a ${titleStatus} title, which affects its value and insurability.` });
  }
  return notes;
}
