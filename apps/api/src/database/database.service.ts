import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { distanceKm } from '../common/geo';
import { APP_CONFIG } from '../config/app-config';
import type { AppConfig } from '../config/app-config';
import { SCHEMA_SQL, SCHEMA_VERSION, TABLES } from './schema';

/**
 * Thin wrapper around a single synchronous better-sqlite3 connection.
 * Synchronous is a feature here: a bid's read-validate-write runs inside one
 * transaction with no interleaving, so there are no race conditions to reason about.
 */
@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly connection: Database.Database;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    if (config.dbPath !== ':memory:') {
      mkdirSync(dirname(config.dbPath), { recursive: true });
    }

    this.connection = new Database(config.dbPath);
    this.connection.pragma('journal_mode = WAL');
    this.connection.pragma('foreign_keys = ON');
    this.migrate();
    this.registerFunctions();
  }

  transaction<T>(work: () => T): T {
    return this.connection.transaction(work)();
  }

  onModuleDestroy(): void {
    this.connection.close();
  }

  /**
   * Everything in the database is derived from data/vehicles.json plus demo
   * activity, so an outdated schema is simply rebuilt (and re-seeded) rather
   * than migrated column by column.
   */
  private migrate(): void {
    const version = this.connection.pragma('user_version', { simple: true }) as number;
    const hasTables = this.connection.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'vehicles'").get();

    if (hasTables && version !== SCHEMA_VERSION) {
      this.logger.warn(`Database schema v${version} is out of date; rebuilding it as v${SCHEMA_VERSION}.`);
      this.transaction(() => {
        for (const table of TABLES) this.connection.exec(`DROP TABLE IF EXISTS ${table}`);
      });
    }

    this.connection.exec(SCHEMA_SQL);
    this.connection.pragma(`user_version = ${SCHEMA_VERSION}`);
  }

  private registerFunctions(): void {
    // distance_km(lat1, lng1, lat2, lng2) → km, or NULL when either point is unknown.
    this.connection.function(
      'distance_km',
      { deterministic: true },
      (lat1: unknown, lng1: unknown, lat2: unknown, lng2: unknown) =>
        [lat1, lng1, lat2, lng2].every((value) => typeof value === 'number')
          ? distanceKm({ lat: lat1 as number, lng: lng1 as number }, { lat: lat2 as number, lng: lng2 as number })
          : null,
    );
  }
}
