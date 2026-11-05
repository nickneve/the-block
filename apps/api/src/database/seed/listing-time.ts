import { randomInt, Rng } from './bid-history';

/**
 * The dataset has no "listed on" date, so we derive one. Lots run for six to
 * eight days, which makes the lots closing last the freshest listings — the
 * same shape as a real timed-auction marketplace. A lot can't have been listed
 * in the future, and a lot with bids needs time for those bids to happen.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export interface ListingInput {
  closesAt: number;
  bidCount: number;
  now: number;
}

export function listingTime({ closesAt, bidCount, now }: ListingInput, rng: Rng): number {
  // Draw every random number up front so the sequence doesn't depend on which branch runs.
  const runHours = randomInt(rng, 6 * 24, 8 * 24);
  const freshAgeMinutes = randomInt(rng, 20, 20 * 60);
  const minAgeWithBids = randomInt(rng, 3, 10) * HOUR;

  const scheduled = closesAt - runHours * HOUR;
  const latest = now - (bidCount > 0 ? Math.max(minAgeWithBids, freshAgeMinutes * MINUTE) : freshAgeMinutes * MINUTE);
  return Math.min(scheduled, latest);
}
