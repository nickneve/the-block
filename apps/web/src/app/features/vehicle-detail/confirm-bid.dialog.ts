import { Dialog, DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuctionApi } from '../../core/api/auction-api';
import { AccountService } from '../../core/account.service';
import { BuyerLocationService } from '../../core/location.service';
import {
  BLOCK_FINANCING,
  dailyInterest,
  DEFAULT_PLAN,
  deliveryQuote,
  PaymentMethod,
  planProblem,
  planTotals,
  PurchasePlan,
  PurchasePlanStore,
} from '../../core/purchase-plan';
import { formatCents, formatKm, formatMoney } from '../../shared/format';
import { LocationDialog } from '../../shared/location.dialog';
import { MoneyPipe } from '../../shared/pipes';
import { IconComponent } from '../../shared/ui/icon.component';

export interface ConfirmBidData {
  kind: 'bid' | 'buy_now';
  vehicleId: string;
  vehicleName: string;
  lot: string;
  amount: number;
  minNextBid: number;
  buyNowPrice: number | null;
  titleStatus: string;
  /** Where the car is: "Highway 7 Auto Sales, Windsor, ON". */
  pickupFrom: string;
  /** Km from the buyer (by road when routing answered), or null without a location. */
  distanceKm: number | null;
}

/**
 * The last checkpoint before a binding commitment. It restates exactly what
 * the buyer is agreeing to, asks how they'll pay and take delivery if they
 * win, and calls out anything they might have missed. Payment and delivery are
 * asked in full once, then remembered and shown as one line with "Change".
 */
@Component({
  selector: 'app-confirm-bid-dialog',
  imports: [MoneyPipe, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'tb-dialog tb-dialog--wide' },
  template: `
    @let d = data;
    @let p = plan();
    <header class="head">
      <div>
        <h2 id="confirm-bid-title">{{ d.kind === 'bid' ? 'Confirm your bid' : 'Buy it now?' }}</h2>
        <p class="vehicle">{{ d.vehicleName }} <span class="muted lot">· Lot {{ d.lot }}</span></p>
      </div>
      <button type="button" class="icon-btn" aria-label="Cancel" (click)="close(false)">
        <svg appIcon="x" [size]="20"></svg>
      </button>
    </header>

    <div class="content">
      <div class="amount-box">
        <span class="eyebrow">{{ d.kind === 'bid' ? 'Your bid' : 'Buy Now price' }}</span>
        <span class="amount tabular">{{ d.amount | money }}</span>
        @if (account(); as account) {
          <span class="bidder">
            {{ d.kind === 'bid' ? 'Bidding' : 'Buying' }} as <strong>{{ account.name }}</strong
            >{{ account.dealership ? ', ' + account.dealership : '' }}
          </span>
        }
      </div>

      @if (!editing()) {
        <section class="plan-summary" aria-label="Payment and delivery">
          <div class="summary-lines">
            <p>
              <svg appIcon="landmark" [size]="16"></svg>
              <span>{{ paymentLine() }}</span>
            </p>
            <p>
              <svg appIcon="truck" [size]="16"></svg>
              <span>{{ deliveryLine() }}</span>
            </p>
          </div>
          <button type="button" class="link-btn" (click)="editing.set(true)">Change</button>
        </section>
      } @else {
        <fieldset class="choices">
          <legend>How will you pay{{ d.kind === 'bid' ? ' if you win' : '' }}?</legend>

          <label class="choice" [class.selected]="p.payment === 'block_financing'" [class.disabled]="!financingFits()">
            <input
              type="radio"
              name="payment"
              [checked]="p.payment === 'block_financing'"
              [disabled]="!financingFits()"
              (change)="setPayment('block_financing')"
            />
            <span class="choice-text">
              <span class="choice-title">
                {{ financing.name }}
                <span class="chip chip--sm chip--success">Pre-approved</span>
              </span>
              <span class="choice-sub">
                Floor plan up to {{ financing.limit | money }} · {{ financing.termDays }} days ·
                {{ financing.apr * 100 }}% APR
              </span>
            </span>
          </label>

          <label class="choice" [class.selected]="p.payment === 'other_lender'">
            <input type="radio" name="payment" [checked]="p.payment === 'other_lender'" (change)="setPayment('other_lender')" />
            <span class="choice-text">
              <span class="choice-title">Another lender</span>
              <span class="choice-sub">Your own floor plan or bank pays the seller</span>
            </span>
          </label>
          @if (p.payment === 'other_lender') {
            <label class="nested">
              <span class="sr-only">Lender name</span>
              <input
                class="input"
                type="text"
                placeholder="Lender or floor plan provider"
                autocomplete="organization"
                maxlength="60"
                [value]="p.lender"
                (input)="update({ lender: $any($event.target).value })"
              />
            </label>
          }

          <label class="choice" [class.selected]="p.payment === 'pay_in_full'">
            <input type="radio" name="payment" [checked]="p.payment === 'pay_in_full'" (change)="setPayment('pay_in_full')" />
            <span class="choice-text">
              <span class="choice-title">Pay in full</span>
              <span class="choice-sub">EFT or wire within 2 business days{{ d.kind === 'bid' ? ' of winning' : '' }}</span>
            </span>
          </label>
        </fieldset>

        <fieldset class="choices">
          <legend>How will you get it?</legend>

          <label class="choice" [class.selected]="p.delivery === 'pickup'">
            <input type="radio" name="delivery" [checked]="p.delivery === 'pickup'" (change)="update({ delivery: 'pickup' })" />
            <span class="choice-text">
              <span class="choice-title">Pick it up</span>
              <span class="choice-sub">Free · {{ d.pickupFrom }}</span>
            </span>
          </label>

          <label class="choice" [class.selected]="p.delivery === 'flatbed'">
            <input type="radio" name="delivery" [checked]="p.delivery === 'flatbed'" (change)="update({ delivery: 'flatbed' })" />
            <span class="choice-text">
              <span class="choice-title">
                Flatbed delivery
                @if (quote(); as quote) {
                  <span class="choice-price tabular">about {{ quote | money }}</span>
                }
              </span>
              <span class="choice-sub">
                @if (route(); as route) {
                  {{ route }}
                } @else {
                  Set your location for a quote
                }
              </span>
            </span>
          </label>
          @if (p.delivery === 'flatbed') {
            <div class="nested">
              @if (quote() === null) {
                <button type="button" class="btn btn--secondary btn--sm" (click)="setLocation()">
                  <svg appIcon="map-pin" [size]="15"></svg>
                  Set your location
                </button>
              } @else if (p.payment === 'block_financing') {
                <label class="check">
                  <input type="checkbox" [checked]="p.financeDelivery" (change)="update({ financeDelivery: $any($event.target).checked })" />
                  Add delivery to my financing
                </label>
              }
            </div>
          }
        </fieldset>
      }

      <section class="totals" aria-label="What you'll pay">
        <p class="eyebrow">{{ d.kind === 'bid' ? 'If you win' : "What you'll pay" }}</p>
        <dl>
          <div>
            <dt>{{ d.kind === 'bid' ? 'Your bid' : 'Vehicle' }}</dt>
            <dd class="tabular">{{ d.amount | money }}</dd>
          </div>
          @if (p.delivery === 'flatbed' && quote() !== null) {
            <div>
              <dt>Flatbed delivery <span class="muted">(estimate)</span></dt>
              <dd class="tabular">{{ totals().delivery | money }}</dd>
            </div>
          }
          <div class="total">
            <dt>Total</dt>
            <dd class="tabular">{{ totals().total | money }}</dd>
          </div>
        </dl>
        <p class="how">{{ settlement() }}</p>
      </section>

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
          this vehicle at your bid. Financing and delivery are simulated in this prototype.
        } @else {
          This purchase is binding and ends the auction immediately. Financing and delivery are simulated in this
          prototype.
        }
      </p>
    </div>

    <footer class="foot">
      @if (attempted() && problem(); as problem) {
        <p class="problem" role="alert">{{ problem }}</p>
      }
      <div class="actions">
        <button type="button" class="btn btn--secondary" (click)="close(false)">Cancel</button>
        <button type="button" class="btn btn--cta" cdkFocusInitial (click)="confirm()">
          {{ d.kind === 'bid' ? 'Place bid' : 'Buy now' }} · {{ d.amount | money }}
        </button>
      </div>
    </footer>
  `,
  styles: `
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-4) var(--space-4) 0 var(--space-5);
    }
    h2 {
      font-size: 20px;
    }
    .vehicle {
      margin-top: 2px;
      font-weight: 600;
    }
    .lot {
      white-space: nowrap;
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      padding: var(--space-4) var(--space-5) var(--space-5);
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
    .bidder {
      color: var(--text-muted);
      font-size: 13.5px;
    }
    .bidder strong {
      color: var(--text);
    }

    /* Remembered choices: one line each, with Change. */
    .plan-summary {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
    }
    .summary-lines {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 14px;
    }
    .summary-lines p {
      display: flex;
      gap: var(--space-2);
      align-items: flex-start;
    }
    .summary-lines svg {
      flex: none;
      margin-top: 2px;
      color: var(--text-subtle);
    }

    /* Choice cards: the whole card is the radio's label. */
    .choices {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      margin: 0;
      padding: 0;
      border: 0;
    }
    legend {
      margin-bottom: var(--space-2);
      padding: 0;
      font-size: 15px;
      font-weight: 700;
    }
    .choice {
      display: flex;
      align-items: flex-start;
      gap: var(--space-3);
      padding: var(--space-3) var(--space-4);
      border: 1px solid var(--border);
      border-radius: var(--radius-md);
      cursor: pointer;
      transition: border-color 0.15s var(--ease), background-color 0.15s var(--ease);
    }
    .choice:hover {
      border-color: var(--border-strong);
    }
    .choice.selected {
      border-color: var(--primary);
      background: var(--primary-soft);
    }
    .choice.disabled {
      cursor: default;
      opacity: 0.55;
    }
    .choice input {
      margin-top: 2px;
    }
    .choice-text {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .choice-title {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-2);
      font-weight: 600;
    }
    .choice-price {
      margin-left: auto;
      font-weight: 700;
    }
    .choice-sub {
      color: var(--text-muted);
      font-size: 13.5px;
    }
    .nested {
      display: block;
      margin: 0 0 var(--space-1) 46px;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    .totals {
      padding: var(--space-4);
      border-radius: var(--radius-md);
      background: var(--surface-muted);
    }
    .totals dl {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: var(--space-2) 0 0;
    }
    .totals dl div {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      font-size: 14px;
    }
    .totals dt {
      color: var(--text-muted);
    }
    .totals dd {
      margin: 0;
      font-weight: 600;
    }
    .totals .total {
      margin-top: 4px;
      padding-top: var(--space-2);
      border-top: 1px solid var(--border);
      font-size: 15px;
    }
    .totals .total dt,
    .totals .total dd {
      color: var(--text);
      font-weight: 800;
    }
    .how {
      margin-top: var(--space-2);
      color: var(--text-muted);
      font-size: 13.5px;
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
      font-size: 13px;
    }

    /* Stays in view while the choices scroll on a small screen. */
    .foot {
      position: sticky;
      bottom: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      padding: var(--space-4) var(--space-5);
      border-top: 1px solid var(--border);
      background: var(--surface);
    }
    .problem {
      color: var(--danger);
      font-size: 14px;
      font-weight: 500;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }
    @media (max-width: 480px) {
      .actions {
        flex-direction: column-reverse;
      }
      .actions .btn {
        width: 100%;
      }
      .nested {
        margin-left: 0;
      }
    }
  `,
})
export class ConfirmBidDialog {
  protected readonly data = inject<ConfirmBidData>(DIALOG_DATA);
  private readonly dialogRef = inject<DialogRef<boolean>>(DialogRef);
  private readonly dialog = inject(Dialog);
  private readonly api = inject(AuctionApi);
  private readonly plans = inject(PurchasePlanStore);
  protected readonly account = inject(AccountService).account;
  protected readonly location = inject(BuyerLocationService).location;

  protected readonly financing = BLOCK_FINANCING;
  protected readonly notes = confirmationNotes(this.data);

  protected readonly distanceKm = signal(this.data.distanceKm);
  protected readonly quote = computed(() => {
    const km = this.distanceKm();
    return km === null ? null : deliveryQuote(km);
  });
  protected readonly plan = signal<PurchasePlan>(this.initialPlan());
  protected readonly totals = computed(() => planTotals(this.data.amount, this.plan(), this.quote()));
  protected readonly problem = computed(() => planProblem(this.plan(), this.data.amount, this.quote()));
  protected readonly financingFits = computed(
    () => planTotals(this.data.amount, { ...this.plan(), payment: 'block_financing' }, this.quote()).financed <= BLOCK_FINANCING.limit,
  );
  /** Ask in full the first time, or when a remembered choice no longer works here. */
  protected readonly editing = signal(this.plans.saved() === null || this.problem() !== null);
  protected readonly attempted = signal(false);

  /** "286 km to Kitchener, ON, door to door", or local delivery in the same city. */
  protected readonly route = computed(() => {
    const km = this.distanceKm();
    const to = this.location()?.label ?? 'you';
    if (km === null) return null;
    return km < 5 ? `Local delivery within ${to}` : `${formatKm(km)} to ${to}, door to door`;
  });

  protected readonly paymentLine = computed(() => {
    const plan = this.plan();
    if (plan.payment === 'other_lender') return `${plan.lender} (your lender)`;
    if (plan.payment === 'pay_in_full') return 'Pay in full by EFT or wire';
    return `${BLOCK_FINANCING.name} floor plan`;
  });
  protected readonly deliveryLine = computed(() => {
    const plan = this.plan();
    if (plan.delivery === 'pickup') return `Pick up from ${this.data.pickupFrom}`;
    const quote = this.quote();
    const financed = plan.payment === 'block_financing' && plan.financeDelivery ? ', financed' : '';
    return `Flatbed delivery to ${this.location()?.label} · about ${formatMoney(quote ?? 0)}${financed}`;
  });

  /** One sentence on who pays what, and when. */
  protected readonly settlement = computed(() => {
    const plan = this.plan();
    const { financed, paidSeparately, delivery } = this.totals();
    if (plan.payment === 'block_financing') {
      const perDay = formatCents(dailyInterest(financed));
      const carrier = paidSeparately > 0 ? ` Delivery (${formatMoney(delivery)}) is paid to the carrier.` : '';
      return `${formatMoney(financed)} financed by The Block: about ${perDay} a day in interest, for up to ${BLOCK_FINANCING.termDays} days.${carrier}`;
    }
    if (plan.payment === 'other_lender') {
      return `${plan.lender.trim() || 'Your lender'} pays the seller. You'll get a bill of sale to send them.`;
    }
    return `Due by EFT or wire within 2 business days${this.data.kind === 'bid' ? ' of winning' : ''}.`;
  });

  protected update(patch: Partial<PurchasePlan>): void {
    this.plan.update((plan) => ({ ...plan, ...patch }));
  }

  protected setPayment(payment: PaymentMethod): void {
    this.update({ payment });
  }

  /** Delivery needs to know where the buyer is; ask, then fetch the road distance to this lot. */
  protected setLocation(): void {
    this.dialog.open<boolean>(LocationDialog).closed.subscribe((changed) => {
      if (!changed) return;
      this.api.vehicle(this.data.vehicleId).subscribe((vehicle) => this.distanceKm.set(vehicle.distanceKm));
    });
  }

  protected confirm(): void {
    this.attempted.set(true);
    if (this.problem()) {
      this.editing.set(true);
      return;
    }
    this.plans.remember(this.plan());
    this.dialogRef.close(true);
  }

  protected close(confirmed: boolean): void {
    this.dialogRef.close(confirmed);
  }

  /** The remembered plan, falling back from in-house financing when this price won't fit the limit. */
  private initialPlan(): PurchasePlan {
    const plan = this.plans.saved() ?? DEFAULT_PLAN;
    const fits = planTotals(this.data.amount, { ...plan, payment: 'block_financing' }, null).financed <= BLOCK_FINANCING.limit;
    return plan.payment === 'block_financing' && !fits ? { ...plan, payment: 'pay_in_full' } : plan;
  }
}

interface ConfirmationNote {
  tone: 'info' | 'warning' | 'danger';
  text: string;
}

/** Things a careful buyer would want pointed out before committing. */
export function confirmationNotes(data: Pick<ConfirmBidData, 'kind' | 'amount' | 'minNextBid' | 'buyNowPrice' | 'titleStatus'>): ConfirmationNote[] {
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
