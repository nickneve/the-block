import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { BidderId } from '../bidders/bidder-id.decorator';
import { BuyerLocation } from '../bidders/buyer-location.decorator';
import type { GeoPoint } from '../common/geo';
import { VehicleDetailDto } from '../vehicles/vehicle.dto';
import { VehiclesService } from '../vehicles/vehicles.service';
import { BidsService } from './bids.service';
import { PlaceBidDto } from './dto/place-bid.dto';

@Controller('vehicles/:id')
export class BidsController {
  constructor(
    private readonly bids: BidsService,
    private readonly vehicles: VehiclesService,
  ) {}

  /** Returns the refreshed vehicle so the client can render the new state immediately. */
  @Post('bids')
  @HttpCode(HttpStatus.CREATED)
  placeBid(
    @Param('id') id: string,
    @Body() body: PlaceBidDto,
    @BidderId({ required: true }) bidderId: string,
    @BuyerLocation() origin: GeoPoint | null,
  ): Promise<VehicleDetailDto> {
    this.bids.placeBid(id, bidderId, body.amount);
    return this.vehicles.detail(id, bidderId, origin);
  }

  @Post('buy-now')
  @HttpCode(HttpStatus.OK)
  buyNow(
    @Param('id') id: string,
    @BidderId({ required: true }) bidderId: string,
    @BuyerLocation() origin: GeoPoint | null,
  ): Promise<VehicleDetailDto> {
    this.bids.buyNow(id, bidderId);
    return this.vehicles.detail(id, bidderId, origin);
  }
}
