import { Controller, Get, Param, Query } from '@nestjs/common';
import { BidderId } from '../bidders/bidder-id.decorator';
import { BuyerLocation } from '../bidders/buyer-location.decorator';
import type { GeoPoint } from '../common/geo';
import { QueryVehiclesDto } from './dto/query-vehicles.dto';
import type { FacetsDto, VehicleDetailDto, VehiclePageDto } from './vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get()
  search(
    @Query() query: QueryVehiclesDto,
    @BidderId() bidderId: string | null,
    @BuyerLocation() origin: GeoPoint | null,
  ): Promise<VehiclePageDto> {
    return this.vehicles.search(query, bidderId, origin);
  }

  @Get('facets')
  facets(@Query() query: QueryVehiclesDto, @BidderId() bidderId: string | null): FacetsDto {
    return this.vehicles.facets(query, bidderId);
  }

  @Get(':id')
  detail(
    @Param('id') id: string,
    @BidderId() bidderId: string | null,
    @BuyerLocation() origin: GeoPoint | null,
  ): Promise<VehicleDetailDto> {
    return this.vehicles.detail(id, bidderId, origin);
  }
}
