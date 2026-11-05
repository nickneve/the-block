import { AuctionState } from '../core/api/models';
import { priceLabel, reservePill } from './lot-view';

const auction = (overrides: Partial<AuctionState> = {}): AuctionState => ({
  status: 'open',
  outcome: null,
  closesAt: '2026-11-06T12:00:00.000Z',
  extended: false,
  startingBid: 5000,
  currentBid: 7000,
  bidCount: 3,
  minNextBid: 7100,
  bidIncrement: 100,
  maxAllowedBid: 70000,
  reserveStatus: 'not_met',
  buyNowPrice: null,
  buyNowAvailable: false,
  soldViaBuyNow: false,
  highBidderHandle: 'Bidder 4821',
  ...overrides,
});

describe('reservePill', () => {
  it('flags a reserve that has not been met, and lots with no reserve', () => {
    expect(reservePill(auction())).toEqual({ text: 'Reserve not met', tone: 'neutral' });
    expect(reservePill(auction({ reserveStatus: 'no_reserve' }))).toEqual({ text: 'No reserve', tone: 'primary' });
  });

  it('stays out of the way once the reserve is met or the lot has ended', () => {
    expect(reservePill(auction({ reserveStatus: 'met' }))).toBeNull();
    expect(reservePill(auction({ status: 'ended', outcome: 'reserve_not_met' }))).toBeNull();
  });
});

describe('priceLabel', () => {
  it('names the price for where the lot is', () => {
    expect(priceLabel(auction({ currentBid: null, bidCount: 0 }))).toBe('Starting bid');
    expect(priceLabel(auction())).toBe('Current bid');
    expect(priceLabel(auction({ status: 'ended', outcome: 'sold' }))).toBe('Sold for');
  });
});
