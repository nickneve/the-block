import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database.service';

export interface SavedSearchRow {
  id: number;
  bidder_id: string;
  name: string;
  query: string;
  created_at: number;
}

@Injectable()
export class SavedSearchesRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.connection;
  }

  listForBidder(bidderId: string): SavedSearchRow[] {
    return this.db
      .prepare('SELECT * FROM saved_searches WHERE bidder_id = ? ORDER BY created_at DESC, id DESC')
      .all(bidderId) as SavedSearchRow[];
  }

  countForBidder(bidderId: string): number {
    const { count } = this.db
      .prepare('SELECT COUNT(*) AS count FROM saved_searches WHERE bidder_id = ?')
      .get(bidderId) as { count: number };
    return count;
  }

  exists(bidderId: string, query: string): boolean {
    return this.db.prepare('SELECT 1 FROM saved_searches WHERE bidder_id = ? AND query = ?').get(bidderId, query) !== undefined;
  }

  /** Saving the same search again just renames it. */
  upsert(bidderId: string, name: string, query: string, now: number): SavedSearchRow {
    return this.db
      .prepare(
        `INSERT INTO saved_searches (bidder_id, name, query, created_at)
         VALUES (@bidderId, @name, @query, @now)
         ON CONFLICT (bidder_id, query) DO UPDATE SET name = excluded.name
         RETURNING *`,
      )
      .get({ bidderId, name, query, now }) as SavedSearchRow;
  }

  remove(bidderId: string, id: number): void {
    this.db.prepare('DELETE FROM saved_searches WHERE bidder_id = ? AND id = ?').run(bidderId, id);
  }
}
