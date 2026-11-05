import {
  auctionStatus,
  bidIncrement,
  damageSeverity,
  isBuyNowAvailable,
  lotOutcome,
  maxAllowedBid,
  minNextBid,
  reserveStatus,
} from '../auctions/auction-rules';
import { bidderHandle } from '../bidders/bidder-identity';
import { estimateMarketValue } from './market-value';
import { BidRow, toLotState, VehicleRow, VehicleWithBidderRow } from './vehicle-row';
import {
  AuctionStateDto,
  BidDto,
  MyBidStatus,
  VehicleDetailDto,
  VehicleSummaryDto,
} from './vehicle.dto';

/** Maps database rows to API responses. All derived auction state is computed here, at read time. */

export function toAuctionState(row: VehicleRow, now: number): AuctionStateDto {
  const lot = toLotState(row);
  const nextBid = minNextBid(lot);

  return {
    status: auctionStatus(lot, now),
    outcome: lotOutcome(lot, now),
    closesAt: new Date(row.closes_at).toISOString(),
    extended: row.closes_at > row.scheduled_close_at,
    startingBid: row.starting_bid,
    currentBid: row.current_bid,
    bidCount: row.bid_count,
    minNextBid: nextBid,
    bidIncrement: bidIncrement(row.current_bid ?? row.starting_bid),
    maxAllowedBid: maxAllowedBid(lot),
    reserveStatus: reserveStatus(lot),
    buyNowPrice: row.buy_now_price,
    buyNowAvailable: isBuyNowAvailable(lot, now),
    soldViaBuyNow: row.sold_via === 'buy_now',
    highBidderHandle: row.high_bidder_id ? bidderHandle(row.high_bidder_id) : null,
  };
}

export function myBidStatus(
  row: VehicleWithBidderRow,
  bidderId: string | null,
  now: number,
): MyBidStatus | null {
  if (bidderId === null || row.my_max_bid === null) return null;

  const leading = row.high_bidder_id === bidderId;
  const outcome = lotOutcome(toLotState(row), now);

  if (outcome === null) return leading ? 'winning' : 'outbid';
  return leading && outcome === 'sold' ? 'won' : 'lost';
}

export function toVehicleSummary(
  row: VehicleWithBidderRow,
  bidderId: string | null,
  now: number,
): VehicleSummaryDto {
  const images = JSON.parse(row.images) as string[];

  return {
    id: row.id,
    lot: row.lot,
    vin: row.vin,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim,
    bodyStyle: row.body_style,
    exteriorColor: row.exterior_color,
    transmission: row.transmission,
    drivetrain: row.drivetrain,
    fuelType: row.fuel_type,
    odometerKm: row.odometer_km,
    conditionGrade: row.condition_grade,
    titleStatus: row.title_status,
    city: row.city,
    province: row.province,
    distanceKm: row.distance_km === null ? null : Math.round(row.distance_km),
    distanceBasis: row.distance_km === null ? null : row.distance_by_road ? 'road' : 'straight_line',
    sellingDealership: row.selling_dealership,
    listedAt: new Date(row.listed_at).toISOString(),
    marketValue: estimateMarketValue(
      {
        year: row.year,
        make: row.make,
        model: row.model,
        odometerKm: row.odometer_km,
        conditionGrade: row.condition_grade,
        titleStatus: row.title_status,
      },
      new Date(now).getFullYear(),
    ),
    thumbnail: images[0] ?? '',
    photoCount: images.length,
    damageCount: (JSON.parse(row.damage_notes) as string[]).length,
    auction: toAuctionState(row, now),
    watched: row.watched === 1,
    myMaxBid: row.my_max_bid,
    myStatus: myBidStatus(row, bidderId, now),
  };
}

export function toBid(row: BidRow, bidderId: string | null): BidDto {
  return {
    id: row.id,
    amount: row.amount,
    bidderHandle: bidderHandle(row.bidder_id),
    isYou: bidderId !== null && row.bidder_id === bidderId,
    placedAt: new Date(row.placed_at).toISOString(),
    kind: row.kind,
  };
}

const SEVERITY_ORDER = { major: 0, mechanical: 1, cosmetic: 2 } as const;

export function toVehicleDetail(
  row: VehicleWithBidderRow,
  bids: BidRow[],
  bidderId: string | null,
  now: number,
): VehicleDetailDto {
  const damageNotes = (JSON.parse(row.damage_notes) as string[])
    .map((text) => ({ text, severity: damageSeverity(text) }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  return {
    ...toVehicleSummary(row, bidderId, now),
    interiorColor: row.interior_color,
    engine: row.engine,
    images: JSON.parse(row.images) as string[],
    conditionReport: row.condition_report,
    damageNotes,
    recentBids: bids.map((bid) => toBid(bid, bidderId)),
  };
}
