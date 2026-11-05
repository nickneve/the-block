import { HttpStatus, Injectable } from '@nestjs/common';
import {
  BidRejection,
  closeTimeAfterBid,
  isBuyNowAvailable,
  validateBid,
} from '../auctions/auction-rules';
import { Clock } from '../common/clock';
import { DomainError } from '../common/domain-error';
import { DatabaseService } from '../database/database.service';
import { BidsRepository } from '../database/repositories/bids.repository';
import { VehiclesRepository } from '../database/repositories/vehicles.repository';
import { AuctionEventsService } from '../events/auction-events.service';
import { toLotState, VehicleRow } from '../vehicles/vehicle-row';
import { vehicleNotFound } from '../vehicles/vehicles.service';

/**
 * The only write path for bids — used by both real buyers and the simulator.
 * Each operation is read → validate → write inside one SQLite transaction,
 * and publishes a change event only after the transaction commits.
 */
@Injectable()
export class BidsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly vehicles: VehiclesRepository,
    private readonly bids: BidsRepository,
    private readonly events: AuctionEventsService,
    private readonly clock: Clock,
  ) {}

  placeBid(vehicleId: string, bidderId: string, amount: number, source: 'user' | 'sim' = 'user'): VehicleRow {
    const now = this.clock.now();

    const updated = this.database.transaction(() => {
      const row = this.requireRow(vehicleId);
      const rejection = validateBid(toLotState(row), amount, bidderId, now);
      if (rejection) throw rejectionToError(rejection);

      this.bids.insert({ vehicleId, bidderId, amount, placedAt: now, kind: 'bid', source });
      this.vehicles.applyBid(vehicleId, { amount, bidderId, closesAt: closeTimeAfterBid(row.closes_at, now) });
      return this.requireRow(vehicleId);
    });

    this.events.publish({
      vehicleId,
      reason: 'bid',
      row: updated,
      lastBid: { amount, bidderId, placedAt: now, kind: 'bid', source },
    });
    return updated;
  }

  buyNow(vehicleId: string, bidderId: string): VehicleRow {
    const now = this.clock.now();

    const updated = this.database.transaction(() => {
      const row = this.requireRow(vehicleId);
      if (!isBuyNowAvailable(toLotState(row), now) || row.buy_now_price === null) {
        throw new DomainError('BUY_NOW_UNAVAILABLE', 'Buy Now is no longer available on this vehicle.', HttpStatus.CONFLICT);
      }

      this.bids.insert({ vehicleId, bidderId, amount: row.buy_now_price, placedAt: now, kind: 'buy_now', source: 'user' });
      this.vehicles.applyBuyNow(vehicleId, bidderId, now);
      return this.requireRow(vehicleId);
    });

    this.events.publish({
      vehicleId,
      reason: 'buy_now',
      row: updated,
      lastBid: { amount: updated.current_bid ?? 0, bidderId, placedAt: now, kind: 'buy_now', source: 'user' },
    });
    return updated;
  }

  private requireRow(vehicleId: string): VehicleRow {
    const row = this.vehicles.findRow(vehicleId);
    if (!row) throw vehicleNotFound(vehicleId);
    return row;
  }
}

function rejectionToError(rejection: BidRejection): DomainError {
  switch (rejection.code) {
    case 'AUCTION_CLOSED':
      return new DomainError('AUCTION_CLOSED', 'Bidding has closed on this vehicle.', HttpStatus.CONFLICT);
    case 'ALREADY_HIGH_BIDDER':
      return new DomainError('ALREADY_HIGH_BIDDER', "You're already the high bidder on this vehicle.", HttpStatus.CONFLICT);
    case 'BID_TOO_LOW':
      return new DomainError('BID_TOO_LOW', 'Your bid is below the current minimum.', HttpStatus.BAD_REQUEST, {
        minNextBid: rejection.minNextBid,
      });
    case 'BID_TOO_HIGH':
      return new DomainError('BID_TOO_HIGH', 'That bid looks unusually high — please double-check the amount.', HttpStatus.BAD_REQUEST, {
        maxAllowedBid: rejection.maxAllowedBid,
      });
  }
}
