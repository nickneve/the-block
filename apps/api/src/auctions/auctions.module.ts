import { Module } from '@nestjs/common';
import { EventsModule } from '../events/events.module';
import { AuctionCloserService } from './auction-closer.service';

@Module({
  imports: [EventsModule],
  providers: [AuctionCloserService],
})
export class AuctionsModule {}
