/**
 * API contract — mirrors apps/api/src/vehicles/vehicle.dto.ts.
 * (With more time: a shared package or OpenAPI-generated client.)
 */

export type AuctionStatus = 'open' | 'ended';
export type LotOutcome = 'sold' | 'reserve_not_met' | 'no_bids';
export type ReserveStatus = 'no_reserve' | 'met' | 'not_met';
export type DamageSeverity = 'cosmetic' | 'mechanical' | 'major';
export type MyBidStatus = 'winning' | 'outbid' | 'won' | 'lost';

export interface AuctionState {
  status: AuctionStatus;
  outcome: LotOutcome | null;
  closesAt: string;
  extended: boolean;
  startingBid: number;
  currentBid: number | null;
  bidCount: number;
  minNextBid: number;
  bidIncrement: number;
  maxAllowedBid: number;
  reserveStatus: ReserveStatus;
  buyNowPrice: number | null;
  buyNowAvailable: boolean;
  soldViaBuyNow: boolean;
  highBidderHandle: string | null;
}

export type DistanceBasis = 'road' | 'straight_line';

export interface VehicleSummary {
  id: string;
  lot: string;
  vin: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  bodyStyle: string;
  exteriorColor: string;
  transmission: string;
  drivetrain: string;
  fuelType: string;
  odometerKm: number;
  conditionGrade: number;
  titleStatus: string;
  city: string;
  province: string;
  /** Km from the buyer; null until they share a location. */
  distanceKm: number | null;
  /** Driving distance, or straight-line when the routing service was unavailable. */
  distanceBasis: DistanceBasis | null;
  sellingDealership: string;
  listedAt: string;
  /** Prototype book value for today, with a typical range. */
  marketValue: MarketValue;
  thumbnail: string;
  photoCount: number;
  damageCount: number;
  auction: AuctionState;
  watched: boolean;
  myMaxBid: number | null;
  myStatus: MyBidStatus | null;
}

export interface MarketValue {
  value: number;
  low: number;
  high: number;
}

export interface DamageNote {
  text: string;
  severity: DamageSeverity;
}

export interface Bid {
  id: number;
  amount: number;
  bidderHandle: string;
  isYou: boolean;
  placedAt: string;
  kind: 'bid' | 'buy_now';
}

export interface VehicleDetail extends VehicleSummary {
  interiorColor: string;
  engine: string;
  images: string[];
  conditionReport: string;
  damageNotes: DamageNote[];
  recentBids: Bid[];
}

export interface StatusCounts {
  open: number;
  closingSoon: number;
  ended: number;
  all: number;
}

export interface VehiclePage {
  items: VehicleSummary[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: StatusCounts;
}

export interface FacetOption {
  value: string;
  count: number;
}

export interface Facets {
  makes: FacetOption[];
  bodyStyles: FacetOption[];
  fuelTypes: FacetOption[];
  provinces: FacetOption[];
  titleStatuses: FacetOption[];
  year: { min: number; max: number };
  price: { min: number; max: number };
  odometer: { max: number };
  /** Lots each 'Show only' toggle would leave, given the other filters. */
  flags: { buyNow: number; noReserve: number; watched: number };
  /** The whole auction by status, ignoring filters. */
  totals: StatusCounts;
}

export interface SavedSearch {
  id: number;
  name: string;
  /** Inventory URL params. */
  query: Record<string, string>;
  createdAt: string;
  matchCount: number;
  /** Matches listed in the last 24 hours. */
  newCount: number;
}

export interface AuctionUpdate {
  vehicleId: string;
  reason: 'bid' | 'buy_now' | 'closed';
  auction: AuctionState;
  lastBid: { amount: number; bidderHandle: string; placedAt: string; kind: 'bid' | 'buy_now' } | null;
}

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'BIDDER_ID_REQUIRED'
  | 'VEHICLE_NOT_FOUND'
  | 'AUCTION_CLOSED'
  | 'BID_TOO_LOW'
  | 'BID_TOO_HIGH'
  | 'ALREADY_HIGH_BIDDER'
  | 'BUY_NOW_UNAVAILABLE'
  | 'SAVED_SEARCH_LIMIT'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: { minNextBid?: number; maxAllowedBid?: number };
}
