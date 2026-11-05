import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { interval, map, merge, Observable } from 'rxjs';
import { bidderHandle } from '../bidders/bidder-identity';
import { Clock } from '../common/clock';
import { AuctionUpdateDto } from '../vehicles/vehicle.dto';
import { toAuctionState } from '../vehicles/vehicle.mapper';
import { AuctionChange, AuctionEventsService } from './auction-events.service';

const HEARTBEAT_MS = 25_000;

@Controller('events')
export class EventsController {
  constructor(
    private readonly events: AuctionEventsService,
    private readonly clock: Clock,
  ) {}

  /** Server-sent events: every connected tab hears every bid, buy-now and close. */
  @Sse()
  stream(): Observable<MessageEvent> {
    const updates = this.events.changes$.pipe(
      map((change): MessageEvent => ({ type: 'auction.updated', data: this.toPublic(change) })),
    );
    // Keeps proxies and idle connections from dropping the stream.
    const heartbeat = interval(HEARTBEAT_MS).pipe(map((): MessageEvent => ({ type: 'ping', data: {} })));
    return merge(updates, heartbeat);
  }

  private toPublic(change: AuctionChange): AuctionUpdateDto {
    return {
      vehicleId: change.vehicleId,
      reason: change.reason,
      auction: toAuctionState(change.row, this.clock.now()),
      lastBid: change.lastBid && {
        amount: change.lastBid.amount,
        bidderHandle: bidderHandle(change.lastBid.bidderId),
        placedAt: new Date(change.lastBid.placedAt).toISOString(),
        kind: change.lastBid.kind,
      },
    };
  }
}
