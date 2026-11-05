import { AuctionState } from '../core/api/models';

/** How a lot's price is labelled and shown in lists (cards, rows, My Bids). */

export function priceLabel(auction: AuctionState): string {
  if (auction.status === 'ended') return auction.outcome === 'sold' ? 'Sold for' : 'Top bid';
  return auction.currentBid === null ? 'Starting bid' : 'Current bid';
}

export function displayPrice(auction: AuctionState): number {
  return auction.currentBid ?? auction.startingBid;
}

export function bidCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'bid' : 'bids'}`;
}

export interface ReservePill {
  text: string;
  tone: 'neutral' | 'primary';
}

/**
 * The reserve, as lists show it: only when it changes a buyer's read of the lot.
 * "Reserve not met" means it may not sell at today's price; "No reserve" means
 * it will sell. A met reserve is the normal case and needs no badge.
 */
export function reservePill(auction: AuctionState): ReservePill | null {
  if (auction.status !== 'open') return null;
  if (auction.reserveStatus === 'not_met') return { text: 'Reserve not met', tone: 'neutral' };
  if (auction.reserveStatus === 'no_reserve') return { text: 'No reserve', tone: 'primary' };
  return null;
}
