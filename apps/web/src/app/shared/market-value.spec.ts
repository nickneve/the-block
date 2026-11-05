import { AuctionState } from '../core/api/models';
import { compareToValue, gaugePositions, valueVerdict } from './market-value';

const estimate = { value: 30_000, low: 28_000, high: 32_000 };

const auction = (patch: Partial<AuctionState>): AuctionState =>
  ({
    status: 'open',
    outcome: null,
    startingBid: 15_000,
    currentBid: 26_400,
    buyNowPrice: null,
    ...patch,
  }) as AuctionState;

describe('compareToValue', () => {
  it('says how far a price is from the estimate', () => {
    expect(compareToValue(26_400, estimate)).toEqual({ percent: -12, text: '12% below the estimate' });
    expect(compareToValue(33_000, estimate)).toEqual({ percent: 10, text: '10% above the estimate' });
  });

  it('calls a price within a couple of percent "about the same"', () => {
    expect(compareToValue(30_300, estimate).text).toBe('about the same as the estimate');
  });
});

describe('valueVerdict', () => {
  it('compares the live bid while the auction is open', () => {
    expect(valueVerdict(auction({}), estimate)).toBe('The current bid of $26,400 is 12% below the estimate.');
  });

  it('uses the starting bid when nobody has bid yet', () => {
    expect(valueVerdict(auction({ currentBid: null }), estimate)).toBe(
      'Bidding starts at $15,000, 50% below the estimate.',
    );
  });

  it('describes how a finished auction ended', () => {
    expect(valueVerdict(auction({ status: 'ended', outcome: 'sold', currentBid: 31_000 }), estimate)).toBe(
      'Sold for $31,000, 3% above the estimate.',
    );
    expect(valueVerdict(auction({ status: 'ended', outcome: 'reserve_not_met' }), estimate)).toBe(
      'The final bid of $26,400 was 12% below the estimate.',
    );
  });
});

describe('gaugePositions', () => {
  it('keeps every marker on the scale, in order', () => {
    const gauge = gaugePositions(estimate, 26_400, 34_000);
    expect(gauge.price).toBeGreaterThan(0);
    expect(gauge.price).toBeLessThan(gauge.low);
    expect(gauge.low).toBeLessThan(gauge.value);
    expect(gauge.value).toBeLessThan(gauge.high);
    expect(gauge.high).toBeLessThan(gauge.buyNow!);
    expect(gauge.buyNow).toBeLessThan(100);
  });

  it('leaves Buy Now off when the lot has none', () => {
    expect(gaugePositions(estimate, 29_000, null).buyNow).toBeNull();
  });
});
