import { formatMoney } from '../../shared/format';
import { checkBid, parseAmount, quickBidAmounts } from './bid-options';
import { confirmationNotes, ConfirmBidData } from './confirm-bid.dialog';

describe('quickBidAmounts', () => {
  it('offers the minimum plus two larger jumps', () => {
    expect(quickBidAmounts(21_250, 250)).toEqual([21_250, 21_750, 22_500]);
  });
});

describe('parseAmount', () => {
  it.each([
    ['23,500', 23_500],
    ['$23500', 23_500],
    [' 23 500 ', 23_500],
    ['', null],
    ['abc', null],
  ])('%s → %s', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });
});

describe('checkBid', () => {
  const limits = { minNextBid: 21_250, maxAllowedBid: 63_750 };

  it('accepts amounts within the limits', () => {
    expect(checkBid(22_000, limits, formatMoney).error).toBeNull();
  });

  it('explains the minimum when the amount is too low', () => {
    expect(checkBid(21_000, limits, formatMoney).error).toContain('$21,250');
  });

  it('flags implausibly high amounts', () => {
    expect(checkBid(250_000, limits, formatMoney).error).toContain('unusually high');
  });
});

describe('confirmationNotes', () => {
  const base: ConfirmBidData = {
    kind: 'bid',
    vehicleId: 'v1',
    vehicleName: '2023 Ford Bronco',
    lot: 'A-0043',
    pickupFrom: 'Maple Motors, Hamilton, ON',
    distanceKm: 90,
    amount: 21_250,
    minNextBid: 21_250,
    buyNowPrice: null,
    titleStatus: 'clean',
  };

  it('has nothing to add for a minimum bid on a clean title', () => {
    expect(confirmationNotes(base)).toEqual([]);
  });

  it('warns when bidding well above the minimum', () => {
    expect(confirmationNotes({ ...base, amount: 30_000 })[0]).toMatchObject({ tone: 'warning' });
  });

  it('points out when Buy Now would be cheaper', () => {
    const notes = confirmationNotes({ ...base, amount: 28_000, buyNowPrice: 27_500 });
    expect(notes.some((note) => note.text.includes('Buy Now'))).toBe(true);
  });

  it('always calls out salvage and rebuilt titles', () => {
    expect(confirmationNotes({ ...base, titleStatus: 'salvage' })).toEqual([
      expect.objectContaining({ tone: 'danger' }),
    ]);
  });
});
