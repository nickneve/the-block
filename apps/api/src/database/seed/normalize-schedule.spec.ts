import { normalizeSchedule } from './normalize-schedule';

const NOW = Date.parse('2026-11-04T15:00:00');
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

describe('normalizeSchedule', () => {
  const timestamps = [
    '2026-03-31T09:00:00',
    '2026-03-31T10:00:00',
    '2026-03-31T10:00:00',
    '2026-03-31T11:00:00',
    '2026-04-02T14:00:00',
  ];

  it('anchors the first still-open slot a short time after now', () => {
    const result = normalizeSchedule(timestamps, NOW, { closedSlots: 2, firstOpenCloseInMs: 20 * MINUTE });
    expect(result[3]).toBe(NOW + 20 * MINUTE);
  });

  it('leaves the earliest slots already closed', () => {
    const result = normalizeSchedule(timestamps, NOW, { closedSlots: 2, firstOpenCloseInMs: 20 * MINUTE });
    expect(result.slice(0, 3).every((time) => time < NOW)).toBe(true);
  });

  it('preserves the original order and spacing between lots', () => {
    const result = normalizeSchedule(timestamps, NOW, { closedSlots: 2, firstOpenCloseInMs: 20 * MINUTE });
    expect(result[1] - result[0]).toBe(HOUR);
    expect(result[1]).toBe(result[2]);
    expect(result[4] - result[0]).toBe(Date.parse(timestamps[4]) - Date.parse(timestamps[0]));
  });

  it('copes with an empty list', () => {
    expect(normalizeSchedule([], NOW)).toEqual([]);
  });
});
