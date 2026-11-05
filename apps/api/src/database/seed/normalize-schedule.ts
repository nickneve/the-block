/**
 * The dataset's `auction_start` values are synthetic and fixed in the past.
 * We treat each one as the moment the car "runs on the block" (bidding closes)
 * and shift the whole schedule so it is relative to "now", preserving the
 * original order and spacing between lots.
 */

export interface ScheduleOptions {
  /** How many of the earliest time slots should already have closed (to show ended states). */
  closedSlots: number;
  /** When the first still-open slot closes, measured from now. */
  firstOpenCloseInMs: number;
}

export const DEFAULT_SCHEDULE: ScheduleOptions = {
  closedSlots: 4,
  firstOpenCloseInMs: 20 * 60 * 1000,
};

/** Dataset timestamps have no offset, so they are read as local wall-clock time. */
export function parseLocalTimestamp(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid auction timestamp: ${value}`);
  }
  return parsed;
}

export function normalizeSchedule(
  timestamps: readonly string[],
  now: number,
  options: ScheduleOptions = DEFAULT_SCHEDULE,
): number[] {
  if (timestamps.length === 0) return [];

  const parsed = timestamps.map(parseLocalTimestamp);
  const slots = [...new Set(parsed)].sort((a, b) => a - b);
  const anchor = slots[Math.min(options.closedSlots, slots.length - 1)];
  const offset = now + options.firstOpenCloseInMs - anchor;

  return parsed.map((time) => time + offset);
}
