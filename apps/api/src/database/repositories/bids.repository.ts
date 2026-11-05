import { Injectable } from '@nestjs/common';
import { BidRow } from '../../vehicles/vehicle-row';
import { DatabaseService } from '../database.service';

export type NewBid = Omit<BidRow, 'id' | 'vehicle_id' | 'bidder_id' | 'placed_at'> & {
  vehicleId: string;
  bidderId: string;
  placedAt: number;
};

@Injectable()
export class BidsRepository {
  constructor(private readonly database: DatabaseService) {}

  insert(bid: NewBid): void {
    this.database.connection
      .prepare(
        `INSERT INTO bids (vehicle_id, bidder_id, amount, placed_at, kind, source)
         VALUES (@vehicleId, @bidderId, @amount, @placedAt, @kind, @source)`,
      )
      .run(bid);
  }

  recentForVehicle(vehicleId: string, limit = 25): BidRow[] {
    return this.database.connection
      .prepare('SELECT * FROM bids WHERE vehicle_id = ? ORDER BY placed_at DESC, id DESC LIMIT ?')
      .all(vehicleId, limit) as BidRow[];
  }
}
