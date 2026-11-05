import { Global, Module } from '@nestjs/common';
import { Clock } from '../common/clock';
import { APP_CONFIG, loadConfig } from '../config/app-config';
import { DatabaseService } from './database.service';
import { BidsRepository } from './repositories/bids.repository';
import { SavedSearchesRepository } from './repositories/saved-searches.repository';
import { VehiclesRepository } from './repositories/vehicles.repository';
import { WatchlistRepository } from './repositories/watchlist.repository';
import { SeedService } from './seed/seed.service';

const REPOSITORIES = [VehiclesRepository, BidsRepository, WatchlistRepository, SavedSearchesRepository];

/**
 * App-wide infrastructure: config, clock, the SQLite connection and the
 * repositories over it. Feature modules hold behaviour; this holds data access.
 */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => loadConfig() },
    Clock,
    DatabaseService,
    SeedService,
    ...REPOSITORIES,
  ],
  exports: [APP_CONFIG, Clock, DatabaseService, ...REPOSITORIES],
})
export class DatabaseModule {}
