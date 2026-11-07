import { formatAge, formatDistance } from './format';

describe('formatAge', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const ago = (ms: number) => new Date(now - ms).toISOString();

  it('reads naturally at every scale', () => {
    expect(formatAge(ago(20_000), now)).toBe('just now');
    expect(formatAge(ago(60_000), now)).toBe('1 minute ago');
    expect(formatAge(ago(5 * 3_600_000), now)).toBe('5 hours ago');
    expect(formatAge(ago(30 * 3_600_000), now)).toBe('yesterday');
    expect(formatAge(ago(4 * 86_400_000), now)).toBe('4 days ago');
  });
});

describe('formatDistance', () => {
  it('rounds to whole km, and calls the same city "Near you"', () => {
    expect(formatDistance(0)).toBe('Near you');
    expect(formatDistance(4, 'road')).toBe('Near you');
    expect(formatDistance(1234)).toBe('1,234 km away');
    expect(formatDistance(420, 'road')).toBe('420 km');
    expect(formatDistance(352, 'straight_line')).toBe('352 km away');
  });
});
