import type {
  AuctionStatus,
  DamageSeverity,
  LotOutcome,
  ReserveStatus,
} from '../auctions/auction-rules';

/** The requesting buyer's relationship to a lot. */
export type MyBidStatus = 'winning' | 'outbid' | 'won' | 'lost';

/** Everything a client needs to render a lot's auction box. Safe to broadcast. */
export interface AuctionStateDto {
  status: AuctionStatus;
  outcome: LotOutcome | null;
  closesAt: string;
  /** True when soft close has pushed the close past its scheduled time. */
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

export interface VehicleSummaryDto {
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
  /** Km from the buyer, when they've shared a location. */
  distanceKm: number | null;
  /** Driving distance, or straight-line when routing was unavailable. */
  distanceBasis: 'road' | 'straight_line' | null;
  sellingDealership: string;
  listedAt: string;
  /** Prototype book value for today (see market-value.ts). */
  marketValue: MarketValueDto;
  thumbnail: string;
  photoCount: number;
  damageCount: number;
  auction: AuctionStateDto;
  watched: boolean;
  myMaxBid: number | null;
  myStatus: MyBidStatus | null;
}

export interface MarketValueDto {
  value: number;
  low: number;
  high: number;
}

export interface DamageNoteDto {
  text: string;
  severity: DamageSeverity;
}

export interface BidDto {
  id: number;
  amount: number;
  bidderHandle: string;
  isYou: boolean;
  placedAt: string;
  kind: 'bid' | 'buy_now';
}

export interface VehicleDetailDto extends VehicleSummaryDto {
  interiorColor: string;
  engine: string;
  images: string[];
  conditionReport: string;
  damageNotes: DamageNoteDto[];
  recentBids: BidDto[];
}

export interface StatusCountsDto {
  open: number;
  closingSoon: number;
  ended: number;
  all: number;
}

export interface VehiclePageDto {
  items: VehicleSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
  statusCounts: StatusCountsDto;
}

export interface FacetOptionDto {
  value: string;
  count: number;
}

export interface FacetsDto {
  makes: FacetOptionDto[];
  bodyStyles: FacetOptionDto[];
  fuelTypes: FacetOptionDto[];
  provinces: FacetOptionDto[];
  titleStatuses: FacetOptionDto[];
  year: { min: number; max: number };
  price: { min: number; max: number };
  odometer: { max: number };
  /** How many lots each 'Show only' toggle would leave, given the other filters. */
  flags: { buyNow: number; noReserve: number; watched: number };
  /** The whole auction by status, ignoring filters (for the page summary). */
  totals: StatusCountsDto;
}

/** Pushed over SSE whenever a lot's auction state changes. */
export interface AuctionUpdateDto {
  vehicleId: string;
  reason: 'bid' | 'buy_now' | 'closed';
  auction: AuctionStateDto;
  lastBid: { amount: number; bidderHandle: string; placedAt: string; kind: 'bid' | 'buy_now' } | null;
}
