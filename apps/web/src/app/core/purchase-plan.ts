import { effect, inject, Injectable, signal } from '@angular/core';
import { AccountService } from './account.service';

/**
 * How a buyer intends to pay for a lot and get it home, asked as part of
 * bidding. Wholesale buyers mostly finance through a floor plan, so the
 * in-house option comes first. Like the account, this is simulated: it's
 * remembered in this browser and nothing is sent to a lender.
 */
export type PaymentMethod = 'block_financing' | 'other_lender' | 'pay_in_full';
export type DeliveryMethod = 'pickup' | 'flatbed';

export interface PurchasePlan {
  payment: PaymentMethod;
  /** The buyer's own floor plan or bank, when paying with another lender. */
  lender: string;
  delivery: DeliveryMethod;
  /** Roll the delivery cost into The Block Financing. */
  financeDelivery: boolean;
}

export const DEFAULT_PLAN: PurchasePlan = {
  payment: 'block_financing',
  lender: '',
  delivery: 'pickup',
  financeDelivery: true,
};

/** The in-house floor plan every signed-in dealer is "pre-approved" for in this prototype. */
export const BLOCK_FINANCING = {
  name: 'The Block Financing',
  limit: 250_000,
  termDays: 90,
  apr: 0.079,
} as const;

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  block_financing: BLOCK_FINANCING.name,
  other_lender: 'Another lender',
  pay_in_full: 'Pay in full',
};

/**
 * Flatbed delivery estimate from the road distance: a pickup fee plus a per-km
 * rate, rounded to $10. Roughly what a dealer-to-dealer carrier quotes; a real
 * build would ask a transport partner.
 */
export function deliveryQuote(km: number): number {
  const BASE = 150;
  const PER_KM = 1.2;
  const MINIMUM = 200;
  return Math.max(MINIMUM, Math.round((BASE + PER_KM * km) / 10) * 10);
}

/** Floor plans are priced per day: what carrying this amount costs while it's financed. */
export function dailyInterest(amount: number): number {
  return (amount * BLOCK_FINANCING.apr) / 365;
}

export interface PlanTotals {
  delivery: number;
  /** What's owed if the buyer wins. */
  total: number;
  /** The part The Block finances (0 unless paying with The Block Financing). */
  financed: number;
  /** The part paid some other way: to another lender, by transfer, or to the carrier. */
  paidSeparately: number;
}

/** Totals for a price under a plan. `deliveryCost` is null when there's no quote (no location yet). */
export function planTotals(price: number, plan: PurchasePlan, deliveryCost: number | null): PlanTotals {
  const delivery = plan.delivery === 'flatbed' ? (deliveryCost ?? 0) : 0;
  const total = price + delivery;
  if (plan.payment !== 'block_financing') return { delivery, total, financed: 0, paidSeparately: total };
  const financed = price + (plan.financeDelivery ? delivery : 0);
  return { delivery, total, financed, paidSeparately: total - financed };
}

/** What still needs an answer before a bid can go in, or null when the plan is complete. */
export function planProblem(plan: PurchasePlan, price: number, deliveryCost: number | null): string | null {
  if (plan.payment === 'other_lender' && !plan.lender.trim()) return 'Enter the lender who will pay for this vehicle.';
  if (plan.delivery === 'flatbed' && deliveryCost === null) return 'Set your location to get a delivery quote, or choose pickup.';
  if (plan.payment === 'block_financing' && planTotals(price, plan, deliveryCost).financed > BLOCK_FINANCING.limit) {
    return `That's more than your ${BLOCK_FINANCING.name} limit. Choose another way to pay.`;
  }
  return null;
}

const STORAGE_KEY = 'the-block.purchase-plan';

/**
 * The buyer's last payment and delivery choices, so the next bid only asks
 * them to confirm. They belong to the account: signing out forgets them.
 */
@Injectable({ providedIn: 'root' })
export class PurchasePlanStore {
  private readonly accounts = inject(AccountService);
  /** Null until the buyer has chosen once. */
  readonly saved = signal<PurchasePlan | null>(read());

  constructor() {
    effect(() => {
      if (!this.accounts.signedIn()) this.saved.set(null);
    });
    effect(() => write(this.saved()));
  }

  remember(plan: PurchasePlan): void {
    this.saved.set({ ...plan, lender: plan.lender.trim() });
  }
}

function read(): PurchasePlan | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<PurchasePlan> | null;
    if (!parsed || !(parsed.payment && parsed.payment in PAYMENT_LABELS)) return null;
    return {
      payment: parsed.payment,
      lender: typeof parsed.lender === 'string' ? parsed.lender : '',
      delivery: parsed.delivery === 'flatbed' ? 'flatbed' : 'pickup',
      financeDelivery: parsed.financeDelivery !== false,
    };
  } catch {
    return null;
  }
}

function write(plan: PurchasePlan | null): void {
  try {
    if (plan) localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: the buyer is simply asked again next time.
  }
}
