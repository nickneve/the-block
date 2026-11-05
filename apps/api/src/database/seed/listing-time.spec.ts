import { mulberry32 } from './bid-history';
import { listingTime } from './listing-time';

const NOW = Date.parse('2026-11-04T12:00:00Z');
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('listingTime', () => {
  it('lists lots six to eight days before they close', () => {
    const closesAt = NOW - 2 * HOUR; // already closed: the schedule isn't clamped
    const rng = mulberry32(1);
    for (let index = 0; index < 50; index += 1) {
      const listedAt = listingTime({ closesAt, bidCount: 3, now: NOW }, rng);
      expect(closesAt - listedAt).toBeGreaterThanOrEqual(6 * DAY);
      expect(closesAt - listedAt).toBeLessThanOrEqual(8 * DAY);
    }
  });

  it('never lists a lot in the future, even when it closes a week out', () => {
    const rng = mulberry32(2);
    for (let index = 0; index < 50; index += 1) {
      const listedAt = listingTime({ closesAt: NOW + 7 * DAY, bidCount: 0, now: NOW }, rng);
      expect(listedAt).toBeLessThan(NOW);
    }
  });

  it('leaves at least three hours for a lot with bids to have collected them', () => {
    const rng = mulberry32(3);
    for (let index = 0; index < 50; index += 1) {
      const listedAt = listingTime({ closesAt: NOW + 7 * DAY, bidCount: 12, now: NOW }, rng);
      expect(NOW - listedAt).toBeGreaterThanOrEqual(3 * HOUR);
    }
  });

  it('is deterministic for a given seed', () => {
    const input = { closesAt: NOW + 3 * DAY, bidCount: 2, now: NOW };
    expect(listingTime(input, mulberry32(9))).toBe(listingTime(input, mulberry32(9)));
  });
});
