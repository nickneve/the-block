import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

@Injectable()
export class WatchlistRepository {
  constructor(private readonly database: DatabaseService) {}

  add(bidderId: string, vehicleId: string, now: number): void {
    this.database.connection
      .prepare('INSERT OR IGNORE INTO watchlist (bidder_id, vehicle_id, created_at) VALUES (?, ?, ?)')
      .run(bidderId, vehicleId, now);
  }

  remove(bidderId: string, vehicleId: string): void {
    this.database.connection
      .prepare('DELETE FROM watchlist WHERE bidder_id = ? AND vehicle_id = ?')
      .run(bidderId, vehicleId);
  }
}
