import { Module } from '@nestjs/common';
import { AuctionEventsService } from './auction-events.service';
import { EventsController } from './events.controller';

@Module({
  controllers: [EventsController],
  providers: [AuctionEventsService],
  exports: [AuctionEventsService],
})
export class EventsModule {}
