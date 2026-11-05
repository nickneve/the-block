/**
 * The dataset gives each lot a `bid_count` and `current_bid` but no history.
 * We synthesise a believable, deterministic history so the detail page can
 * show a real bid timeline that ends exactly at the dataset's current bid.
 */

export type Rng = () => number;

/** Same seeded PRNG as scripts/generate_vehicles.mjs, so seeds are reproducible. */
export function mulberry32(seed: number): Rng {
  let state = seed;
  return () => {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

export interface HistoryInput {
  startingBid: number;
  currentBid: number | null;
  bidCount: number;
  closesAt: number;
  now: number;
  /** Bids can't predate the listing. */
  listedAt?: number;
}

export interface SeedBid {
  bidderId: string;
  amount: number;
  placedAt: number;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export function generateBidHistory(input: HistoryInput, rng: Rng, rivals: readonly string[]): SeedBid[] {
  const { startingBid, currentBid, bidCount } = input;
  if (currentBid === null || bidCount <= 0) return [];

  const amounts = bidCount === 1 ? [currentBid] : climbingAmounts(startingBid, currentBid, bidCount, rng);
  const times = spreadTimes(Math.min(input.now, input.closesAt), input.listedAt ?? -Infinity, bidCount, rng);
  const bidders = alternatingBidders(bidCount, rng, rivals);

  return amounts.map((amount, index) => ({ amount, placedAt: times[index], bidderId: bidders[index] }));
}

/** n strictly increasing amounts from `start` to exactly `end`. */
function climbingAmounts(start: number, end: number, count: number, rng: Rng): number[] {
  const steps = count - 1;
  const unit = (end - start) / 25 >= steps ? 25 : 1;
  const totalUnits = Math.floor((end - start) / unit);

  // Every step gets at least one unit; the rest is shared out by random weight.
  const weights = Array.from({ length: steps }, () => 0.5 + rng());
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const spare = totalUnits - steps;
  const stepUnits = weights.map((weight) => 1 + Math.floor((spare * weight) / weightSum));

  const amounts = [start];
  for (const units of stepUnits) {
    amounts.push(amounts[amounts.length - 1] + units * unit);
  }
  amounts[amounts.length - 1] = end; // absorb rounding so the history lands on the real current bid
  return amounts;
}

function spreadTimes(latestPossible: number, earliestPossible: number, count: number, rng: Rng): number[] {
  const end = latestPossible - randomInt(rng, 3, 90) * MINUTE;
  const start = Math.min(end - MINUTE, Math.max(earliestPossible + 5 * MINUTE, end - randomInt(rng, 6, 48) * HOUR));
  const fractions = Array.from({ length: count - 1 }, () => rng()).sort((a, b) => a - b);
  return [...fractions.map((fraction) => Math.round(start + (end - start) * fraction)), end];
}

/** Random rivals, never the same bidder twice in a row (nobody outbids themselves). */
function alternatingBidders(count: number, rng: Rng, rivals: readonly string[]): string[] {
  const bidders: string[] = [];
  for (let index = 0; index < count; index += 1) {
    let next: string;
    do {
      next = rivals[randomInt(rng, 0, rivals.length - 1)];
    } while (next === bidders[index - 1]);
    bidders.push(next);
  }
  return bidders;
}

/**
 * Hidden price where simulated rivals stop bidding, so a real buyer can
 * always win by going above it. Never above Buy Now.
 */
export function marketCeiling(
  lot: { startingBid: number; reservePrice: number | null; buyNowPrice: number | null; currentBid: number | null },
  rng: Rng,
): number {
  const reference =
    lot.reservePrice ?? lot.buyNowPrice ?? Math.max(lot.currentBid ?? 0, lot.startingBid * 1.35);
  let ceiling = Math.round((reference * (0.92 + rng() * 0.2)) / 500) * 500;
  if (lot.buyNowPrice !== null) ceiling = Math.min(ceiling, lot.buyNowPrice - 500);
  return Math.max(ceiling, lot.startingBid);
}
