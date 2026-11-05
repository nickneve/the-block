import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { filter, Subscription } from 'rxjs';
import { auctionStatus, minNextBid } from '../auctions/auction-rules';
import { RIVAL_BIDDER_IDS } from '../bidders/bidder-identity';
import { BidsService } from '../bids/bids.service';
import { Clock } from '../common/clock';
import { APP_CONFIG } from '../config/app-config';
import type { AppConfig } from '../config/app-config';
import { VehiclesRepository } from '../database/repositories/vehicles.repository';
import { AuctionEventsService } from '../events/auction-events.service';
import { toLotState, VehicleRow } from '../vehicles/vehicle-row';

const HOUR = 60 * 60 * 1000;
/** Chance a rival answers a real buyer's bid (while under the lot's market ceiling). */
const RESPONSE_PROBABILITY = 0.75;

/**
 * Simulated competing dealers so a solo demo still feels like a live auction.
 *  - Reactive: when a real buyer bids, a rival often answers a few seconds later.
 *  - Ambient: every so often a rival bids somewhere, favouring lots closing soon.
 * Rivals never bid past a lot's hidden market ceiling, so buyers can always win.
 * All bids go through BidsService — the same validation path as real buyers.
 */
@Injectable()
export class BidSimulatorService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(BidSimulatorService.name);
  private readonly timers = new Set<NodeJS.Timeout>();
  private subscription?: Subscription;

  constructor(
    private readonly bids: BidsService,
    private readonly vehicles: VehiclesRepository,
    private readonly events: AuctionEventsService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.simulateBidding) return;

    this.subscription = this.events.changes$
      .pipe(filter((change) => change.lastBid?.source === 'user' && change.lastBid.kind === 'bid'))
      .subscribe((change) => {
        if (Math.random() < RESPONSE_PROBABILITY) {
          this.after(randomBetween(4_000, 15_000), () => this.bidAsRival(change.vehicleId));
        }
      });

    this.scheduleAmbientBid();
    this.logger.log('Rival bidders are active (set SIMULATE_BIDDING=false to turn them off).');
  }

  onApplicationShutdown(): void {
    this.subscription?.unsubscribe();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }

  /** Places the minimum next bid as a rival. Returns false if the rival declines. */
  bidAsRival(vehicleId: string): boolean {
    const row = this.vehicles.findRow(vehicleId);
    if (!row || auctionStatus(toLotState(row), this.clock.now()) === 'ended') return false;

    const amount = minNextBid(toLotState(row));
    if (amount > row.market_ceiling) return false;

    const rivals = RIVAL_BIDDER_IDS.filter((id) => id !== row.high_bidder_id);
    const rival = rivals[Math.floor(Math.random() * rivals.length)];

    try {
      this.bids.placeBid(vehicleId, rival, amount, 'sim');
      return true;
    } catch {
      return false; // e.g. a real buyer got there first — just skip this turn
    }
  }

  private scheduleAmbientBid(): void {
    this.after(randomBetween(8_000, 20_000), () => {
      const lot = this.pickAmbientLot();
      if (lot) this.bidAsRival(lot.id);
      this.scheduleAmbientBid();
    });
  }

  private pickAmbientLot(): VehicleRow | undefined {
    const now = this.clock.now();
    const candidates = this.vehicles
      .findOpen(now)
      .filter((row) => minNextBid(toLotState(row)) <= row.market_ceiling);

    const weights = candidates.map((row) => {
      const remaining = row.closes_at - now;
      if (remaining < HOUR) return 6;
      if (remaining < 24 * HOUR) return 2;
      return 1;
    });

    let target = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
    return candidates.find((_, index) => (target -= weights[index]) <= 0);
  }

  private after(delayMs: number, work: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      work();
    }, delayMs);
    this.timers.add(timer);
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
