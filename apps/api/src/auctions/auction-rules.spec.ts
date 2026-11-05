import {
  auctionStatus,
  bidIncrement,
  closeTimeAfterBid,
  damageSeverity,
  isBuyNowAvailable,
  LotState,
  lotOutcome,
  minNextBid,
  reserveStatus,
  SOFT_CLOSE_WINDOW_MS,
  validateBid,
} from './auction-rules';

const NOW = Date.parse('2026-11-04T12:00:00Z');
const HOUR = 60 * 60 * 1000;

function lot(overrides: Partial<LotState> = {}): LotState {
  return {
    startingBid: 10_000,
    reservePrice: 15_000,
    buyNowPrice: null,
    currentBid: null,
    highBidderId: null,
    closesAt: NOW + HOUR,
    soldVia: null,
    ...overrides,
  };
}

describe('bidIncrement', () => {
  it.each([
    [500, 100],
    [9_999, 100],
    [10_000, 250],
    [29_999, 250],
    [30_000, 500],
    [59_999, 500],
    [60_000, 1_000],
    [120_000, 1_000],
  ])('at $%d the increment is $%d', (amount, expected) => {
    expect(bidIncrement(amount)).toBe(expected);
  });
});

describe('minNextBid', () => {
  it('is the starting bid when nobody has bid yet', () => {
    expect(minNextBid(lot({ currentBid: null }))).toBe(10_000);
  });

  it('is the current bid plus one increment once bidding has started', () => {
    expect(minNextBid(lot({ currentBid: 21_000 }))).toBe(21_250);
    expect(minNextBid(lot({ currentBid: 9_900 }))).toBe(10_000);
  });
});

describe('auctionStatus and lotOutcome', () => {
  it('is open before the close time and ended after it', () => {
    expect(auctionStatus(lot(), NOW)).toBe('open');
    expect(auctionStatus(lot({ closesAt: NOW }), NOW)).toBe('ended');
  });

  it('is ended immediately after a Buy Now, regardless of the timer', () => {
    expect(auctionStatus(lot({ soldVia: 'buy_now' }), NOW)).toBe('ended');
    expect(lotOutcome(lot({ soldVia: 'buy_now', currentBid: 20_000 }), NOW)).toBe('sold');
  });

  it('has no outcome while open', () => {
    expect(lotOutcome(lot({ currentBid: 20_000 }), NOW)).toBeNull();
  });

  it('resolves ended lots to sold, reserve not met, or no bids', () => {
    const ended = { closesAt: NOW - 1 };
    expect(lotOutcome(lot({ ...ended, currentBid: 16_000 }), NOW)).toBe('sold');
    expect(lotOutcome(lot({ ...ended, currentBid: 12_000 }), NOW)).toBe('reserve_not_met');
    expect(lotOutcome(lot({ ...ended, currentBid: null }), NOW)).toBe('no_bids');
    expect(lotOutcome(lot({ ...ended, reservePrice: null, currentBid: 10_000 }), NOW)).toBe('sold');
  });
});

describe('reserveStatus', () => {
  it('never reveals the amount, only whether it is met', () => {
    expect(reserveStatus(lot({ reservePrice: null }))).toBe('no_reserve');
    expect(reserveStatus(lot({ currentBid: 14_999 }))).toBe('not_met');
    expect(reserveStatus(lot({ currentBid: 15_000 }))).toBe('met');
  });
});

describe('isBuyNowAvailable', () => {
  it('requires an open lot with a Buy Now price above the current bid', () => {
    expect(isBuyNowAvailable(lot({ buyNowPrice: 25_000 }), NOW)).toBe(true);
    expect(isBuyNowAvailable(lot({ buyNowPrice: null }), NOW)).toBe(false);
    expect(isBuyNowAvailable(lot({ buyNowPrice: 25_000, currentBid: 25_000 }), NOW)).toBe(false);
    expect(isBuyNowAvailable(lot({ buyNowPrice: 25_000, closesAt: NOW - 1 }), NOW)).toBe(false);
  });
});

describe('closeTimeAfterBid (soft close)', () => {
  it('leaves the close alone when there is plenty of time left', () => {
    expect(closeTimeAfterBid(NOW + HOUR, NOW)).toBe(NOW + HOUR);
  });

  it('extends to two minutes from now when a bid lands in the final two minutes', () => {
    expect(closeTimeAfterBid(NOW + 30_000, NOW)).toBe(NOW + SOFT_CLOSE_WINDOW_MS);
  });
});

describe('validateBid', () => {
  it('accepts a bid at the minimum', () => {
    expect(validateBid(lot({ currentBid: 21_000, highBidderId: 'rival-01' }), 21_250, 'buyer-123', NOW)).toBeNull();
  });

  it('rejects bids below the minimum and reports the minimum', () => {
    expect(validateBid(lot({ currentBid: 21_000 }), 21_100, 'buyer-123', NOW)).toEqual({
      code: 'BID_TOO_LOW',
      minNextBid: 21_250,
    });
  });

  it('rejects bids on closed lots', () => {
    expect(validateBid(lot({ closesAt: NOW - 1 }), 50_000, 'buyer-123', NOW)).toEqual({ code: 'AUCTION_CLOSED' });
  });

  it('stops a buyer from bidding against themselves', () => {
    expect(validateBid(lot({ currentBid: 21_000, highBidderId: 'buyer-123' }), 22_000, 'buyer-123', NOW)).toEqual({
      code: 'ALREADY_HIGH_BIDDER',
    });
  });

  it('catches fat-finger bids far above the minimum', () => {
    expect(validateBid(lot({ currentBid: 20_000 }), 2_000_000, 'buyer-123', NOW)).toMatchObject({
      code: 'BID_TOO_HIGH',
    });
  });
});

describe('damageSeverity', () => {
  it.each([
    ['Frame damage - right front (repaired)', 'major'],
    ['Flood damage - electrical issues present', 'major'],
    ['Airbag deployed - replaced with OEM parts', 'major'],
    ['Transmission slips between 2nd and 3rd gear', 'mechanical'],
    ['Check engine light - catalytic converter code', 'mechanical'],
    ['Worn brake rotors - due for replacement', 'mechanical'],
    ['Minor scratches on front bumper', 'cosmetic'],
    ['Light hail damage on roof', 'cosmetic'],
  ])('%s → %s', (note, expected) => {
    expect(damageSeverity(note)).toBe(expected);
  });
});
