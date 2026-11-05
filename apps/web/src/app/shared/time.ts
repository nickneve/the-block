/** Countdown maths, pure so it can be unit-tested without a clock. */

export type Urgency = 'calm' | 'soon' | 'urgent' | 'ended';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function urgency(remainingMs: number): Urgency {
  if (remainingMs <= 0) return 'ended';
  if (remainingMs < 5 * MINUTE) return 'urgent';
  if (remainingMs < HOUR) return 'soon';
  return 'calm';
}

/** Two most significant units: "2d 4h", "3h 12m", "12m 05s", "45s". */
export function formatRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return 'Ended';

  const days = Math.floor(remainingMs / DAY);
  const hours = Math.floor((remainingMs % DAY) / HOUR);
  const minutes = Math.floor((remainingMs % HOUR) / MINUTE);
  const seconds = Math.floor((remainingMs % MINUTE) / SECOND);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

/** Listed within the last 24 hours — matches the API's "new" window for saved searches. */
export const NEW_LISTING_WINDOW_MS = DAY;

export function isNewListing(listedAt: string, now: number): boolean {
  const age = now - Date.parse(listedAt);
  return age >= 0 && age < NEW_LISTING_WINDOW_MS;
}
