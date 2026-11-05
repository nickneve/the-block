/**
 * Auction rules as pure functions — no I/O, no clock reads. Everything that
 * decides "can this bid happen?" or "what state is this lot in?" lives here so
 * it can be unit-tested directly and reused by the simulator.
 */

export type AuctionStatus = 'open' | 'ended';
export type LotOutcome = 'sold' | 'reserve_not_met' | 'no_bids';
export type ReserveStatus = 'no_reserve' | 'met' | 'not_met';
export type DamageSeverity = 'cosmetic' | 'mechanical' | 'major';

/** The subset of a lot the rules need. */
export interface LotState {
  startingBid: number;
  reservePrice: number | null;
  buyNowPrice: number | null;
  currentBid: number | null;
  highBidderId: string | null;
  closesAt: number;
  soldVia: 'buy_now' | null;
}

/** A bid in the final two minutes pushes the close out (anti-sniping). */
export const SOFT_CLOSE_WINDOW_MS = 2 * 60 * 1000;

/** Guard against fat-finger bids (an extra zero). */
export const MAX_BID_MULTIPLE = 3;

export function bidIncrement(amount: number): number {
  if (amount < 10_000) return 100;
  if (amount < 30_000) return 250;
  if (amount < 60_000) return 500;
  return 1_000;
}

export function minNextBid(lot: Pick<LotState, 'currentBid' | 'startingBid'>): number {
  return lot.currentBid === null ? lot.startingBid : lot.currentBid + bidIncrement(lot.currentBid);
}

export function maxAllowedBid(lot: Pick<LotState, 'currentBid' | 'startingBid'>): number {
  return Math.max(minNextBid(lot) * MAX_BID_MULTIPLE, 10_000);
}

export function auctionStatus(lot: Pick<LotState, 'closesAt' | 'soldVia'>, now: number): AuctionStatus {
  if (lot.soldVia !== null) return 'ended';
  return lot.closesAt > now ? 'open' : 'ended';
}

export function reserveStatus(lot: Pick<LotState, 'reservePrice' | 'currentBid'>): ReserveStatus {
  if (lot.reservePrice === null) return 'no_reserve';
  return lot.currentBid !== null && lot.currentBid >= lot.reservePrice ? 'met' : 'not_met';
}

/** How an ended lot resolved. `null` while bidding is still open. */
export function lotOutcome(lot: LotState, now: number): LotOutcome | null {
  if (auctionStatus(lot, now) === 'open') return null;
  if (lot.soldVia === 'buy_now') return 'sold';
  if (lot.currentBid === null) return 'no_bids';
  return reserveStatus(lot) === 'not_met' ? 'reserve_not_met' : 'sold';
}

export function isBuyNowAvailable(lot: LotState, now: number): boolean {
  return (
    auctionStatus(lot, now) === 'open' &&
    lot.buyNowPrice !== null &&
    (lot.currentBid ?? 0) < lot.buyNowPrice
  );
}

/** Returns the (possibly extended) close time after a bid lands at `now`. */
export function closeTimeAfterBid(closesAt: number, now: number): number {
  return closesAt - now < SOFT_CLOSE_WINDOW_MS ? now + SOFT_CLOSE_WINDOW_MS : closesAt;
}

export type BidRejection =
  | { code: 'AUCTION_CLOSED' }
  | { code: 'ALREADY_HIGH_BIDDER' }
  | { code: 'BID_TOO_LOW'; minNextBid: number }
  | { code: 'BID_TOO_HIGH'; maxAllowedBid: number };

/** `null` means the bid is acceptable. */
export function validateBid(lot: LotState, amount: number, bidderId: string, now: number): BidRejection | null {
  if (auctionStatus(lot, now) === 'ended') return { code: 'AUCTION_CLOSED' };
  if (lot.highBidderId === bidderId) return { code: 'ALREADY_HIGH_BIDDER' };

  const minimum = minNextBid(lot);
  if (amount < minimum) return { code: 'BID_TOO_LOW', minNextBid: minimum };

  const maximum = maxAllowedBid(lot);
  if (amount > maximum) return { code: 'BID_TOO_HIGH', maxAllowedBid: maximum };

  return null;
}

const MAJOR_DAMAGE = [/frame/i, /flood/i, /airbag/i, /water damage/i];
const MECHANICAL_DAMAGE = [/transmission/i, /check engine/i, /compressor/i, /brake/i, /electrical/i];

/** Buckets free-text damage notes so serious issues can be surfaced first. */
export function damageSeverity(note: string): DamageSeverity {
  if (MAJOR_DAMAGE.some((pattern) => pattern.test(note))) return 'major';
  if (MECHANICAL_DAMAGE.some((pattern) => pattern.test(note))) return 'mechanical';
  return 'cosmetic';
}
