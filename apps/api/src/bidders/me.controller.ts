import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
import { Clock } from '../common/clock';
import { VehiclesRepository } from '../database/repositories/vehicles.repository';
import { WatchlistRepository } from '../database/repositories/watchlist.repository';
import { VehicleSummaryDto } from '../vehicles/vehicle.dto';
import { vehicleNotFound, VehiclesService } from '../vehicles/vehicles.service';
import type { GeoPoint } from '../common/geo';
import { BidderId } from './bidder-id.decorator';
import { BuyerLocation } from './buyer-location.decorator';
import { bidderHandle } from './bidder-identity';

/** The anonymous buyer's own view: identity, bids and watchlist. */
@Controller('me')
export class MeController {
  constructor(
    private readonly vehiclesService: VehiclesService,
    private readonly vehicles: VehiclesRepository,
    private readonly watchlist: WatchlistRepository,
    private readonly clock: Clock,
  ) {}

  @Get()
  me(@BidderId({ required: true }) bidderId: string): { handle: string } {
    return { handle: bidderHandle(bidderId) };
  }

  @Get('bids')
  myBids(
    @BidderId({ required: true }) bidderId: string,
    @BuyerLocation() origin: GeoPoint | null,
  ): Promise<VehicleSummaryDto[]> {
    return this.vehiclesService.listForBidder(bidderId, 'bids', origin);
  }

  @Get('watchlist')
  myWatchlist(
    @BidderId({ required: true }) bidderId: string,
    @BuyerLocation() origin: GeoPoint | null,
  ): Promise<VehicleSummaryDto[]> {
    return this.vehiclesService.listForBidder(bidderId, 'watchlist', origin);
  }

  @Put('watchlist/:vehicleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  watch(@Param('vehicleId') vehicleId: string, @BidderId({ required: true }) bidderId: string): void {
    if (!this.vehicles.exists(vehicleId)) throw vehicleNotFound(vehicleId);
    this.watchlist.add(bidderId, vehicleId, this.clock.now());
  }

  @Delete('watchlist/:vehicleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  unwatch(@Param('vehicleId') vehicleId: string, @BidderId({ required: true }) bidderId: string): void {
    this.watchlist.remove(bidderId, vehicleId);
  }
}
