import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { VehicleRow } from '../vehicles/vehicle-row';

/**
 * Internal event, carrying raw rows and bidder ids. The SSE controller maps it
 * to a public payload before anything leaves the server.
 */
export interface AuctionChange {
  vehicleId: string;
  reason: 'bid' | 'buy_now' | 'closed';
  row: VehicleRow;
  lastBid: {
    amount: number;
    bidderId: string;
    placedAt: number;
    kind: 'bid' | 'buy_now';
    source: 'user' | 'sim';
  } | null;
}

/** In-process pub/sub for auction state changes. */
@Injectable()
export class AuctionEventsService {
  private readonly changes = new Subject<AuctionChange>();

  readonly changes$: Observable<AuctionChange> = this.changes.asObservable();

  publish(change: AuctionChange): void {
    this.changes.next(change);
  }
}
