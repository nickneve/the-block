import { formatRemaining, isNewListing, urgency } from './time';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRemaining', () => {
  it.each([
    [2 * DAY + 4 * HOUR + 30 * MINUTE, '2d 4h'],
    [3 * HOUR + 12 * MINUTE, '3h 12m'],
    [12 * MINUTE + 5 * SECOND, '12m 05s'],
    [45 * SECOND, '45s'],
    [0, 'Ended'],
    [-5 * SECOND, 'Ended'],
  ])('%d ms → %s', (ms, expected) => {
    expect(formatRemaining(ms)).toBe(expected);
  });
});

describe('urgency', () => {
  it('escalates as the close approaches', () => {
    expect(urgency(2 * HOUR)).toBe('calm');
    expect(urgency(30 * MINUTE)).toBe('soon');
    expect(urgency(4 * MINUTE)).toBe('urgent');
    expect(urgency(0)).toBe('ended');
  });
});

describe('isNewListing', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');

  it('is true for lots listed in the last 24 hours', () => {
    expect(isNewListing('2026-11-04T01:00:00Z', now)).toBe(true);
    expect(isNewListing('2026-11-03T11:00:00Z', now)).toBe(false);
  });

  it('ignores listing times in the future', () => {
    expect(isNewListing('2026-11-05T00:00:00Z', now)).toBe(false);
  });
});
