import { HttpStatus, Injectable } from '@nestjs/common';
import { Clock } from '../common/clock';
import { DomainError } from '../common/domain-error';
import type { BuyerOrigin, GeoPoint } from '../common/geo';
import { BidsRepository } from '../database/repositories/bids.repository';
import { VehicleQuery, VehiclesRepository } from '../database/repositories/vehicles.repository';
import { RoadDistancesService } from '../routing/road-distances';
import { QueryVehiclesDto } from './dto/query-vehicles.dto';
import { FacetsDto, VehicleDetailDto, VehiclePageDto, VehicleSummaryDto } from './vehicle.dto';
import { toVehicleDetail, toVehicleSummary } from './vehicle.mapper';

@Injectable()
export class VehiclesService {
  constructor(
    private readonly vehicles: VehiclesRepository,
    private readonly bids: BidsRepository,
    private readonly clock: Clock,
    private readonly roads: RoadDistancesService,
  ) {}

  async search(dto: QueryVehiclesDto, bidderId: string | null, origin: GeoPoint | null = null): Promise<VehiclePageDto> {
    const query: VehicleQuery = { ...toVehicleQuery(dto, bidderId), origin: await this.withRoads(origin) };
    const now = this.clock.now();

    const result = this.vehicles.search(query, bidderId, now);
    return {
      items: result.rows.map((row) => toVehicleSummary(row, bidderId, now)),
      total: result.total,
      page: dto.page,
      pageSize: dto.pageSize,
      statusCounts: result.statusCounts,
    };
  }

  /** Total matches for a search, and how many of those were listed in the last day. */
  countMatches(dto: QueryVehiclesDto, bidderId: string): { matchCount: number; newCount: number } {
    const now = this.clock.now();
    const query = toVehicleQuery(dto, bidderId);
    return {
      matchCount: this.vehicles.count(query, bidderId, now),
      newCount: this.vehicles.count({ ...query, listedAfter: now - NEW_LISTING_WINDOW_MS }, bidderId, now),
    };
  }

  /** Filter options and counts for the buyer's current search (paging and sort are ignored). */
  facets(dto: QueryVehiclesDto, bidderId: string | null): FacetsDto {
    return this.vehicles.facets(toVehicleQuery(dto, bidderId), bidderId, this.clock.now());
  }

  async detail(id: string, bidderId: string | null, origin: GeoPoint | null = null): Promise<VehicleDetailDto> {
    const row = this.vehicles.findWithBidder(id, bidderId, await this.withRoads(origin));
    if (!row) throw vehicleNotFound(id);
    return toVehicleDetail(row, this.bids.recentForVehicle(id), bidderId, this.clock.now());
  }

  /** Every lot the bidder has bid on or is watching (prototype scale — no paging needed). */
  async listForBidder(
    bidderId: string,
    filter: 'bids' | 'watchlist',
    origin: GeoPoint | null = null,
  ): Promise<VehicleSummaryDto[]> {
    const roadOrigin = await this.withRoads(origin);
    const now = this.clock.now();
    const { rows } = this.vehicles.search(
      {
        status: 'all',
        sort: 'closing',
        myBidsOnly: filter === 'bids',
        watchedOnly: filter === 'watchlist',
        origin: roadOrigin,
        limit: 500,
        offset: 0,
      },
      bidderId,
      now,
    );
    return rows.map((row) => toVehicleSummary(row, bidderId, now));
  }

  /** Adds driving distances to the buyer's location (cached per location; null falls back to straight-line). */
  private async withRoads(origin: GeoPoint | null): Promise<BuyerOrigin | null> {
    return origin ? { ...origin, roadKm: await this.roads.fromOrigin(origin) } : null;
  }
}

/** "New" means listed within the last 24 hours. */
export const NEW_LISTING_WINDOW_MS = 24 * 60 * 60 * 1000;

export function vehicleNotFound(id: string): DomainError {
  return new DomainError('VEHICLE_NOT_FOUND', `No vehicle with id ${id}.`, HttpStatus.NOT_FOUND);
}

function toVehicleQuery(dto: QueryVehiclesDto, bidderId: string | null): VehicleQuery {
  return {
    q: dto.q?.trim(),
    makes: dto.make,
    bodyStyles: dto.bodyStyle,
    fuelTypes: dto.fuelType,
    provinces: dto.province,
    titleStatuses: dto.titleStatus,
    minGrade: dto.minGrade,
    maxKm: dto.maxKm,
    yearMin: dto.yearMin,
    yearMax: dto.yearMax,
    priceMin: dto.priceMin,
    priceMax: dto.priceMax,
    buyNowOnly: dto.buyNow,
    noReserveOnly: dto.noReserve,
    watchedOnly: dto.watched && bidderId !== null,
    status: dto.status,
    sort: dto.sort,
    limit: dto.pageSize,
    offset: (dto.page - 1) * dto.pageSize,
  };
}
