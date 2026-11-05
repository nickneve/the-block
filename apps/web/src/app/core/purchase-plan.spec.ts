import { Dialog } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { AuthPrompt } from '../layout/auth-prompt.service';
import { AccountService } from './account.service';
import {
  BLOCK_FINANCING,
  dailyInterest,
  DEFAULT_PLAN,
  deliveryQuote,
  planProblem,
  planTotals,
  PurchasePlan,
  PurchasePlanStore,
} from './purchase-plan';

const plan = (overrides: Partial<PurchasePlan> = {}): PurchasePlan => ({ ...DEFAULT_PLAN, ...overrides });

describe('purchase plan maths', () => {
  it('quotes flatbed delivery from the road distance, with a minimum', () => {
    expect(deliveryQuote(286)).toBe(490);
    expect(deliveryQuote(3398)).toBe(4230);
    expect(deliveryQuote(10)).toBe(200);
  });

  it('rolls delivery into in-house financing only when asked', () => {
    const financed = planTotals(10_000, plan({ delivery: 'flatbed', financeDelivery: true }), 490);
    expect(financed).toEqual({ delivery: 490, total: 10_490, financed: 10_490, paidSeparately: 0 });

    const carrierPaid = planTotals(10_000, plan({ delivery: 'flatbed', financeDelivery: false }), 490);
    expect(carrierPaid).toEqual({ delivery: 490, total: 10_490, financed: 10_000, paidSeparately: 490 });
  });

  it('finances nothing when paying another way', () => {
    expect(planTotals(10_000, plan({ payment: 'pay_in_full', delivery: 'flatbed' }), 490).financed).toBe(0);
    expect(planTotals(10_000, plan({ delivery: 'pickup' }), 490).delivery).toBe(0);
  });

  it('prices a floor plan per day', () => {
    expect(dailyInterest(36_500)).toBeCloseTo(36_500 * BLOCK_FINANCING.apr / 365);
  });

  it('says what is missing before a bid can go in', () => {
    expect(planProblem(plan({ payment: 'other_lender', lender: '  ' }), 10_000, null)).toMatch(/lender/);
    expect(planProblem(plan({ delivery: 'flatbed' }), 10_000, null)).toMatch(/location/);
    expect(planProblem(plan(), BLOCK_FINANCING.limit + 1, null)).toMatch(/limit/);
    expect(planProblem(plan({ payment: 'other_lender', lender: 'Prairie Credit Union' }), 10_000, null)).toBeNull();
  });
});

describe('PurchasePlanStore', () => {
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('remembers choices for a signed-in buyer and forgets them on sign-out', () => {
    const accounts = TestBed.inject(AccountService);
    accounts.createAccount({ name: 'Sam Okafor', email: 'sam@northside.ca', dealership: 'Northside Motors' });
    const store = TestBed.inject(PurchasePlanStore);

    store.remember(plan({ payment: 'other_lender', lender: ' Prairie Credit Union ' }));
    TestBed.tick();
    expect(store.saved()?.lender).toBe('Prairie Credit Union');

    accounts.signOut();
    TestBed.tick();
    expect(store.saved()).toBeNull();
  });
});

describe('AuthPrompt', () => {
  afterEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('lets a signed-in buyer straight through without opening anything', async () => {
    const open = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: Dialog, useValue: { open } }] });
    TestBed.inject(AccountService).createAccount({ name: 'Sam Okafor', email: 'sam@northside.ca', dealership: '' });

    await expect(TestBed.inject(AuthPrompt).ensureSignedIn('bid')).resolves.toBe(true);
    expect(open).not.toHaveBeenCalled();
  });
});
