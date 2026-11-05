import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Clock } from '../common/clock';
import { VehiclesRepository } from '../database/repositories/vehicles.repository';
import { AuctionEventsService } from '../events/auction-events.service';

const CHECK_EVERY_MS = 2_000;

/**
 * Lots close by the clock, not by a write — so nothing would otherwise tell
 * connected clients "this lot just sold". This watches for timers that ran
 * out and announces them, which powers the "You won" notification.
 */
@Injectable()
export class AuctionCloserService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  private lastCheck = 0;

  constructor(
    private readonly vehicles: VehiclesRepository,
    private readonly events: AuctionEventsService,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    this.lastCheck = this.clock.now();
    this.timer = setInterval(() => this.announceClosedLots(), CHECK_EVERY_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  announceClosedLots(): void {
    const now = this.clock.now();
    for (const row of this.vehicles.findNaturallyClosedBetween(this.lastCheck, now)) {
      this.events.publish({ vehicleId: row.id, reason: 'closed', row, lastBid: null });
    }
    this.lastCheck = now;
  }
}
