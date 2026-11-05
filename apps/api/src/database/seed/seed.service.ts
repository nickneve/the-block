import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { RIVAL_BIDDER_IDS } from '../../bidders/bidder-identity';
import { Clock } from '../../common/clock';
import { APP_CONFIG, AppConfig } from '../../config/app-config';
import { DatabaseService } from '../database.service';
import { generateBidHistory, marketCeiling, mulberry32 } from './bid-history';
import { cityCoordinates } from './city-coordinates';
import { listingTime } from './listing-time';
import { normalizeSchedule } from './normalize-schedule';
import { RawVehicle } from './raw-vehicle';

/** Loads data/vehicles.json into an empty database on first boot. */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly clock: Clock,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    const { count } = this.database.connection
      .prepare('SELECT COUNT(*) AS count FROM vehicles')
      .get() as { count: number };

    if (count === 0) {
      this.seed();
    }
  }

  seed(): void {
    const vehicles = JSON.parse(readFileSync(this.config.vehiclesJsonPath, 'utf8')) as RawVehicle[];
    const now = this.clock.now();
    const closeTimes = normalizeSchedule(
      vehicles.map((vehicle) => vehicle.auction_start),
      now,
    );
    const rng = mulberry32(42);
    // A separate stream for listing times keeps the bid history identical to earlier seeds.
    const listingRng = mulberry32(7);

    const insertVehicle = this.database.connection.prepare(`
      INSERT INTO vehicles (
        id, lot, vin, year, make, model, trim, body_style, exterior_color, interior_color,
        engine, transmission, drivetrain, odometer_km, fuel_type, condition_grade, condition_report,
        damage_notes, title_status, province, city, latitude, longitude, selling_dealership, images, search_text,
        starting_bid, reserve_price, buy_now_price, listed_at, scheduled_close_at, closes_at,
        current_bid, bid_count, high_bidder_id, sold_via, market_ceiling
      ) VALUES (
        @id, @lot, @vin, @year, @make, @model, @trim, @body_style, @exterior_color, @interior_color,
        @engine, @transmission, @drivetrain, @odometer_km, @fuel_type, @condition_grade, @condition_report,
        @damage_notes, @title_status, @province, @city, @latitude, @longitude, @selling_dealership, @images, @search_text,
        @starting_bid, @reserve_price, @buy_now_price, @listed_at, @closes_at, @closes_at,
        @current_bid, @bid_count, @high_bidder_id, NULL, @market_ceiling
      )`);
    const insertBid = this.database.connection.prepare(`
      INSERT INTO bids (vehicle_id, bidder_id, amount, placed_at, kind, source)
      VALUES (@vehicleId, @bidderId, @amount, @placedAt, 'bid', 'seed')`);

    this.database.transaction(() => {
      vehicles.forEach((vehicle, index) => {
        const closesAt = closeTimes[index];
        const listedAt = listingTime({ closesAt, bidCount: vehicle.bid_count, now }, listingRng);
        const location = cityCoordinates(vehicle.city, vehicle.province);
        const history = generateBidHistory(
          {
            startingBid: vehicle.starting_bid,
            currentBid: vehicle.current_bid,
            bidCount: vehicle.bid_count,
            closesAt,
            now,
            listedAt,
          },
          rng,
          RIVAL_BIDDER_IDS,
        );

        insertVehicle.run({
          ...vehicle,
          damage_notes: JSON.stringify(vehicle.damage_notes),
          images: JSON.stringify(vehicle.images),
          search_text: searchText(vehicle),
          closes_at: closesAt,
          listed_at: listedAt,
          latitude: location?.lat ?? null,
          longitude: location?.lng ?? null,
          high_bidder_id: history.at(-1)?.bidderId ?? null,
          market_ceiling: marketCeiling(
            {
              startingBid: vehicle.starting_bid,
              reservePrice: vehicle.reserve_price,
              buyNowPrice: vehicle.buy_now_price,
              currentBid: vehicle.current_bid,
            },
            rng,
          ),
        });

        for (const bid of history) {
          insertBid.run({ vehicleId: vehicle.id, ...bid });
        }
      });
    });

    const closed = closeTimes.filter((time) => time <= now).length;
    this.logger.log(
      `Seeded ${vehicles.length} vehicles (${vehicles.length - closed} open, ${closed} already closed). ` +
        `Run "npm run db:reset" to re-anchor auction times to now.`,
    );
  }
}

function searchText(vehicle: RawVehicle): string {
  return [
    vehicle.year,
    vehicle.make,
    vehicle.model,
    vehicle.trim,
    vehicle.body_style,
    vehicle.exterior_color,
    vehicle.vin,
    vehicle.lot,
    vehicle.selling_dealership,
    vehicle.city,
    vehicle.province,
  ]
    .join(' ')
    .toLowerCase();
}
