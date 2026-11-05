import { Inject, Injectable, Logger } from '@nestjs/common';
import type { GeoPoint } from '../common/geo';
import { CITY_COORDINATES } from '../database/seed/city-coordinates';

/** Driving km from the buyer to each dealership city, keyed "City, Province". */
export type RoadKm = Readonly<Record<string, number>>;

/**
 * Driving distances in km from one point to many, in order; null where no
 * route exists. Rejects when the routing service can't answer.
 */
export type RouteTable = (origin: GeoPoint, destinations: readonly GeoPoint[]) => Promise<(number | null)[]>;

/** Injection token for the route table; null turns driving distances off. */
export const ROUTE_TABLE = Symbol('ROUTE_TABLE');

const TIMEOUT_MS = 4000;
/** After a failed lookup, fall back to straight-line for a minute before asking again. */
const RETRY_AFTER_MS = 60_000;
/** Distinct buyer locations remembered (~1 km grid), oldest dropped first. */
const MAX_ORIGINS = 1000;

/**
 * OSRM's table service: one request returns driving distances from the buyer
 * to every destination. The public demo server needs no key, which keeps the
 * prototype clone-and-run; production would point `ROUTING_URL` at its own.
 */
export function osrmRouteTable(baseUrl: string, fetchFn: typeof fetch = fetch): RouteTable {
  return async (origin, destinations) => {
    const coordinates = [origin, ...destinations].map((point) => `${point.lng},${point.lat}`).join(';');
    const response = await fetchFn(`${baseUrl}/table/v1/driving/${coordinates}?sources=0&annotations=distance`, {
      headers: { 'User-Agent': 'the-block-prototype' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`Routing service answered ${response.status}`);
    const body = (await response.json()) as { code?: string; distances?: (number | null)[][] };
    if (body.code !== 'Ok' || !body.distances?.[0]) throw new Error(`Routing service answered ${body.code}`);
    return body.distances[0].slice(1).map((metres) => (metres === null ? null : metres / 1000));
  };
}

/**
 * Driving distances from a buyer to every dealership city, for "Closest to me"
 * and the "km away" on each lot. Straight-line distance understates the trip,
 * often by 20% or more around the Great Lakes, and pickup and transport are
 * priced by road. One request covers all cities, and each location is cached,
 * so a buyer's later requests cost nothing. Resolves null (straight-line
 * fallback) when routing is off or unavailable.
 */
@Injectable()
export class RoadDistancesService {
  private readonly logger = new Logger(RoadDistancesService.name);
  private readonly cache = new Map<string, Promise<RoadKm | null>>();
  private readonly cities = Object.entries(CITY_COORDINATES);

  constructor(@Inject(ROUTE_TABLE) private readonly table: RouteTable | null) {}

  fromOrigin(origin: GeoPoint): Promise<RoadKm | null> {
    if (!this.table) return Promise.resolve(null);
    const key = `${origin.lat.toFixed(2)},${origin.lng.toFixed(2)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    // Cache the promise itself, so concurrent first requests share one lookup.
    const lookup = this.lookup(this.table, origin, key);
    this.cache.set(key, lookup);
    if (this.cache.size > MAX_ORIGINS) this.cache.delete(this.cache.keys().next().value!);
    return lookup;
  }

  private async lookup(table: RouteTable, origin: GeoPoint, key: string): Promise<RoadKm | null> {
    try {
      const km = await table(
        origin,
        this.cities.map(([, point]) => point),
      );
      return Object.fromEntries(
        this.cities.flatMap(([city], i) => (km[i] === null || km[i] === undefined ? [] : [[city, km[i]]])),
      );
    } catch (error) {
      this.logger.warn(`Driving distances unavailable, using straight-line: ${(error as Error).message}`);
      setTimeout(() => this.cache.delete(key), RETRY_AFTER_MS).unref();
      return null;
    }
  }
}
