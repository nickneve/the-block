import { HttpStatus, Injectable } from '@nestjs/common';
import { Clock } from '../common/clock';
import { DomainError } from '../common/domain-error';
import { SavedSearchesRepository, SavedSearchRow } from '../database/repositories/saved-searches.repository';
import { VehiclesService } from '../vehicles/vehicles.service';
import { canonicalSearchParams, fromQueryString, toQueryDto, toQueryString } from './saved-search-query';

export const MAX_SAVED_SEARCHES = 20;

export interface SavedSearchDto {
  id: number;
  name: string;
  /** Inventory URL params, ready to navigate with. */
  query: Record<string, string>;
  createdAt: string;
  /** Lots matching right now. */
  matchCount: number;
  /** Of those, how many were listed in the last 24 hours. */
  newCount: number;
}

@Injectable()
export class SavedSearchesService {
  constructor(
    private readonly savedSearches: SavedSearchesRepository,
    private readonly vehicles: VehiclesService,
    private readonly clock: Clock,
  ) {}

  list(bidderId: string): SavedSearchDto[] {
    return this.savedSearches.listForBidder(bidderId).map((row) => this.toDto(row, bidderId));
  }

  save(bidderId: string, name: string, rawQuery: Record<string, unknown>): SavedSearchDto {
    const params = canonicalSearchParams(rawQuery);
    const query = toQueryString(params);
    if (query === '') {
      throw new DomainError(
        'VALIDATION_FAILED',
        'Add a search term, filter or sort before saving.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const isNew = !this.savedSearches.exists(bidderId, query);
    if (isNew && this.savedSearches.countForBidder(bidderId) >= MAX_SAVED_SEARCHES) {
      throw new DomainError(
        'SAVED_SEARCH_LIMIT',
        `You can keep up to ${MAX_SAVED_SEARCHES} saved searches. Remove one to save another.`,
        HttpStatus.CONFLICT,
      );
    }

    const row = this.savedSearches.upsert(bidderId, name.trim(), query, this.clock.now());
    return this.toDto(row, bidderId);
  }

  remove(bidderId: string, id: number): void {
    this.savedSearches.remove(bidderId, id);
  }

  private toDto(row: SavedSearchRow, bidderId: string): SavedSearchDto {
    const query = fromQueryString(row.query);
    return {
      id: row.id,
      name: row.name,
      query,
      createdAt: new Date(row.created_at).toISOString(),
      ...this.vehicles.countMatches(toQueryDto(query), bidderId),
    };
  }
}
