import { Module } from '@nestjs/common';
import { BidsModule } from '../bids/bids.module';
import { EventsModule } from '../events/events.module';
import { BidSimulatorService } from './bid-simulator.service';

@Module({
  imports: [BidsModule, EventsModule],
  providers: [BidSimulatorService],
})
export class SimulatorModule {}
