import type { LotState } from '../auctions/auction-rules';

/** A `vehicles` table row exactly as SQLite returns it. */
export interface VehicleRow {
  id: string;
  lot: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body_style: string;
  exterior_color: string;
  interior_color: string;
  engine: string;
  transmission: string;
  drivetrain: string;
  odometer_km: number;
  fuel_type: string;
  condition_grade: number;
  condition_report: string;
  damage_notes: string;
  title_status: string;
  province: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  selling_dealership: string;
  images: string;
  search_text: string;
  starting_bid: number;
  reserve_price: number | null;
  buy_now_price: number | null;
  listed_at: number;
  scheduled_close_at: number;
  closes_at: number;
  current_bid: number | null;
  bid_count: number;
  high_bidder_id: string | null;
  sold_via: 'buy_now' | null;
  market_ceiling: number;
}

/** A vehicle row joined with the requesting bidder's own context. */
export interface VehicleWithBidderRow extends VehicleRow {
  watched: 0 | 1;
  my_max_bid: number | null;
  /** Only when the buyer shared a location: driving km, or straight-line when routing was unavailable. */
  distance_km: number | null;
  distance_by_road: 0 | 1 | null;
}

export interface BidRow {
  id: number;
  vehicle_id: string;
  bidder_id: string;
  amount: number;
  placed_at: number;
  kind: 'bid' | 'buy_now';
  source: 'seed' | 'user' | 'sim';
}

export function toLotState(row: VehicleRow): LotState {
  return {
    startingBid: row.starting_bid,
    reservePrice: row.reserve_price,
    buyNowPrice: row.buy_now_price,
    currentBid: row.current_bid,
    highBidderId: row.high_bidder_id,
    closesAt: row.closes_at,
    soldVia: row.sold_via,
  };
}
