/** Pure helpers behind the bid panel. */

/** One-tap amounts: the minimum, then a couple of comfortable jumps above it. */
export function quickBidAmounts(minNextBid: number, increment: number): number[] {
  return [minNextBid, minNextBid + increment * 2, minNextBid + increment * 5];
}

/** Accepts "23,500", "$23500", " 23 500 " → 23500. Empty or non-numeric → null. */
export function parseAmount(text: string): number | null {
  const digits = text.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}

export interface BidCheck {
  amount: number;
  error: string | null;
}

/** Client-side mirror of the server rules, for instant feedback (the server stays authoritative). */
export function checkBid(
  amount: number,
  limits: { minNextBid: number; maxAllowedBid: number },
  format: (value: number) => string,
): BidCheck {
  if (amount < limits.minNextBid) {
    return { amount, error: `Enter at least ${format(limits.minNextBid)}.` };
  }
  if (amount > limits.maxAllowedBid) {
    return { amount, error: `That's unusually high — bids are capped at ${format(limits.maxAllowedBid)} here.` };
  }
  return { amount, error: null };
}
