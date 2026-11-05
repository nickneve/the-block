import { generateBidHistory, marketCeiling, mulberry32 } from './bid-history';

const NOW = Date.parse('2026-11-04T12:00:00Z');
const RIVALS = ['rival-01', 'rival-02', 'rival-03'];

describe('generateBidHistory', () => {
  it('returns nothing for lots without bids', () => {
    const history = generateBidHistory(
      { startingBid: 10_000, currentBid: null, bidCount: 0, closesAt: NOW + 1, now: NOW },
      mulberry32(1),
      RIVALS,
    );
    expect(history).toEqual([]);
  });

  it.each([1, 2, 7, 18])('creates %d strictly increasing bids ending at the current bid', (bidCount) => {
    const history = generateBidHistory(
      { startingBid: 20_500, currentBid: 21_000, bidCount, closesAt: NOW + 60_000, now: NOW },
      mulberry32(bidCount),
      RIVALS,
    );

    expect(history).toHaveLength(bidCount);
    expect(history.at(-1)?.amount).toBe(21_000);
    history.slice(1).forEach((bid, index) => {
      expect(bid.amount).toBeGreaterThan(history[index].amount);
      expect(bid.placedAt).toBeGreaterThanOrEqual(history[index].placedAt);
      expect(bid.bidderId).not.toBe(history[index].bidderId);
    });
  });

  it('places every bid before the lot closed', () => {
    const closesAt = NOW - 60 * 60 * 1000;
    const history = generateBidHistory(
      { startingBid: 5_000, currentBid: 9_000, bidCount: 6, closesAt, now: NOW },
      mulberry32(7),
      RIVALS,
    );
    expect(history.every((bid) => bid.placedAt < closesAt)).toBe(true);
  });

  it('never places a bid before the lot was listed', () => {
    const listedAt = NOW - 2 * 60 * 60 * 1000;
    const history = generateBidHistory(
      { startingBid: 5_000, currentBid: 12_000, bidCount: 15, closesAt: NOW + 86_400_000, now: NOW, listedAt },
      mulberry32(11),
      RIVALS,
    );
    expect(history).toHaveLength(15);
    expect(history.every((bid) => bid.placedAt > listedAt && bid.placedAt < NOW)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const input = { startingBid: 5_000, currentBid: 9_000, bidCount: 6, closesAt: NOW + 1, now: NOW };
    expect(generateBidHistory(input, mulberry32(3), RIVALS)).toEqual(generateBidHistory(input, mulberry32(3), RIVALS));
  });
});

describe('marketCeiling', () => {
  it('never exceeds the Buy Now price', () => {
    const ceiling = marketCeiling(
      { startingBid: 10_000, reservePrice: 30_000, buyNowPrice: 28_000, currentBid: 12_000 },
      () => 0.99,
    );
    expect(ceiling).toBeLessThan(28_000);
  });

  it('is never below the starting bid', () => {
    const ceiling = marketCeiling(
      { startingBid: 10_000, reservePrice: null, buyNowPrice: 9_000, currentBid: null },
      () => 0,
    );
    expect(ceiling).toBe(10_000);
  });
});
