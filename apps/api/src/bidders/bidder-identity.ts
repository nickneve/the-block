import { createHash } from 'node:crypto';

/**
 * Buyers are anonymous: the browser generates a UUID and sends it as
 * `X-Bidder-Id`. Raw IDs never leave the server — other clients only ever
 * see the derived public handle ("Bidder 4821").
 */

/** Simulated competitors used for seeded history and the live bid simulator. */
export const RIVAL_BIDDER_IDS: readonly string[] = Array.from(
  { length: 14 },
  (_, index) => `rival-${String(index + 1).padStart(2, '0')}`,
);

const RIVAL_PREFIX = 'rival-';
const BIDDER_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

export function bidderHandle(bidderId: string): string {
  const digest = createHash('sha256').update(bidderId).digest();
  return `Bidder ${(digest.readUInt32BE(0) % 9000) + 1000}`;
}

/** Rival ids are reserved for the simulator, so a client can't impersonate one. */
export function isValidBidderId(value: string): boolean {
  return BIDDER_ID_PATTERN.test(value) && !value.startsWith(RIVAL_PREFIX);
}
