import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { BidsController } from './bids.controller';
import { BidsService } from './bids.service';

@Module({
  imports: [EventsModule, VehiclesModule],
  controllers: [BidsController],
  providers: [BidsService],
  exports: [BidsService],
})
export class BidsModule {}
