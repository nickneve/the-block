import { AuctionState, MarketValue } from '../core/api/models';
import { formatMoney } from './format';

/** Within this many percent of the estimate reads as "about the same". */
const NEAR_PERCENT = 2;

export interface ValueComparison {
  /** Signed difference from the estimate, rounded (negative = below). */
  percent: number;
  /** e.g. "12% below the estimate", "about the same as the estimate". */
  text: string;
}

export function compareToValue(amount: number, estimate: MarketValue): ValueComparison {
  const percent = Math.round(((amount - estimate.value) / estimate.value) * 100);
  if (Math.abs(percent) < NEAR_PERCENT) return { percent, text: 'about the same as the estimate' };
  return { percent, text: `${Math.abs(percent)}% ${percent < 0 ? 'below' : 'above'} the estimate` };
}

/** One plain sentence placing the lot's price against its estimated value. */
export function valueVerdict(auction: AuctionState, estimate: MarketValue): string {
  const amount = auction.currentBid ?? auction.startingBid;
  const { text } = compareToValue(amount, estimate);
  const price = formatMoney(amount);

  if (auction.status === 'open') {
    return auction.currentBid === null
      ? `Bidding starts at ${price}, ${text}.`
      : `The current bid of ${price} is ${text}.`;
  }
  if (auction.outcome === 'sold') return `Sold for ${price}, ${text}.`;
  if (auction.currentBid === null) return `No bids were placed. Bidding opened at ${price}, ${text}.`;
  return `The final bid of ${price} was ${text}.`;
}

export interface GaugePositions {
  low: number;
  high: number;
  value: number;
  price: number;
  buyNow: number | null;
}

/**
 * Positions (0–100%) for a value gauge: the estimate's range, the current price and
 * Buy Now, on a scale padded a little beyond whichever is lowest and highest.
 */
export function gaugePositions(estimate: MarketValue, price: number, buyNow: number | null): GaugePositions {
  const points = [estimate.low, estimate.high, price, ...(buyNow === null ? [] : [buyNow])];
  const min = Math.min(...points) * 0.92;
  const max = Math.max(...points) * 1.05;
  const at = (amount: number) => Math.round(((amount - min) / (max - min)) * 1000) / 10;
  return {
    low: at(estimate.low),
    high: at(estimate.high),
    value: at(estimate.value),
    price: at(price),
    buyNow: buyNow === null ? null : at(buyNow),
  };
}
