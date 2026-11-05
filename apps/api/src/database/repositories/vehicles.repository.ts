import { Injectable } from '@nestjs/common';
import type { BuyerOrigin } from '../../common/geo';
import { FacetOptionDto, FacetsDto, StatusCountsDto } from '../../vehicles/vehicle.dto';
import { VehicleRow, VehicleWithBidderRow } from '../../vehicles/vehicle-row';
import { DatabaseService } from '../database.service';

export const SORT_KEYS = [
  'closing',
  'listed_desc',
  'distance',
  'price_asc',
  'price_desc',
  'year_desc',
  'km_asc',
  'bids_desc',
  'grade_desc',
] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const STATUS_FILTERS = ['open', 'closing_soon', 'ended', 'all'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export interface VehicleQuery {
  q?: string;
  makes?: string[];
  bodyStyles?: string[];
  fuelTypes?: string[];
  provinces?: string[];
  titleStatuses?: string[];
  minGrade?: number;
  maxKm?: number;
  yearMin?: number;
  yearMax?: number;
  priceMin?: number;
  priceMax?: number;
  buyNowOnly?: boolean;
  noReserveOnly?: boolean;
  watchedOnly?: boolean;
  myBidsOnly?: boolean;
  /** Only lots listed after this time (epoch ms). */
  listedAfter?: number;
  /** The buyer's location, when shared: adds distances and enables the "distance" sort. */
  origin?: BuyerOrigin | null;
  status: StatusFilter;
  sort: SortKey;
  limit: number;
  offset: number;
}

export interface VehicleSearchResult {
  rows: VehicleWithBidderRow[];
  total: number;
  statusCounts: StatusCountsDto;
}

/** "Closing soon" means within the next 24 hours. */
export const CLOSING_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

const IS_OPEN = '(v.sold_via IS NULL AND v.closes_at > @now)';
const CURRENT_PRICE = 'COALESCE(v.current_bid, v.starting_bid)';

/** Joins in the requesting bidder's watchlist flag and highest bid. */
const FROM_WITH_BIDDER = `
  FROM vehicles v
  LEFT JOIN watchlist w ON w.vehicle_id = v.id AND w.bidder_id = @bidderId
  LEFT JOIN (
    SELECT vehicle_id, MAX(amount) AS max_amount
    FROM bids WHERE bidder_id = @bidderId GROUP BY vehicle_id
  ) my ON my.vehicle_id = v.id`;

/** Driving km to this lot's city, from the buyer's road distances (a JSON object keyed "City, Province"). */
const ROAD_KM = `json_extract(@roadKm, '$."' || v.city || ', ' || v.province || '"')`;

const SELECT_WITH_BIDDER = `SELECT v.*, (w.vehicle_id IS NOT NULL) AS watched, my.max_amount AS my_max_bid,
  CASE WHEN @hasOrigin THEN COALESCE(${ROAD_KM}, distance_km(v.latitude, v.longitude, @originLat, @originLng)) END AS distance_km,
  CASE WHEN @hasOrigin THEN ${ROAD_KM} IS NOT NULL END AS distance_by_road
  ${FROM_WITH_BIDDER}`;

/** Whitelisted ORDER BY clauses — user input never reaches SQL directly. */
const ORDER_BY: Record<SortKey, string> = {
  closing: `${IS_OPEN} DESC, CASE WHEN ${IS_OPEN} THEN v.closes_at END ASC, v.closes_at DESC`,
  listed_desc: 'v.listed_at DESC',
  // Lots without a known location go last; ties go to whichever closes first.
  distance: 'distance_km IS NULL, distance_km ASC, v.closes_at ASC',
  price_asc: `${CURRENT_PRICE} ASC`,
  price_desc: `${CURRENT_PRICE} DESC`,
  year_desc: 'v.year DESC',
  km_asc: 'v.odometer_km ASC',
  bids_desc: 'v.bid_count DESC',
  grade_desc: 'v.condition_grade DESC',
};

/** Filter groups shown as option lists, and the column each one filters. */
const FACET_COLUMNS = {
  makes: 'v.make',
  bodyStyles: 'v.body_style',
  fuelTypes: 'v.fuel_type',
  provinces: 'v.province',
  titleStatuses: 'v.title_status',
} as const;
type FacetKey = keyof typeof FACET_COLUMNS;

/** What a facet count is computed against: a search without paging or ordering. */
export type FacetQuery = Omit<VehicleQuery, 'sort' | 'limit' | 'offset' | 'origin'>;

const STATUS_CLAUSE: Record<StatusFilter, string | null> = {
  open: IS_OPEN,
  closing_soon: `${IS_OPEN} AND v.closes_at <= @soon`,
  ended: `NOT ${IS_OPEN}`,
  all: null,
};

@Injectable()
export class VehiclesRepository {
  constructor(private readonly database: DatabaseService) {}

  private get db() {
    return this.database.connection;
  }

  search(query: VehicleQuery, bidderId: string | null, now: number): VehicleSearchResult {
    const { clauses, params } = buildFilters(query);
    Object.assign(params, contextParams(bidderId, now, query.origin), {
      limit: query.limit,
      offset: query.offset,
    });

    const statusClause = STATUS_CLAUSE[query.status];
    const where = whereSql(statusClause ? [...clauses, statusClause] : clauses);
    // "Closest to me" without a location falls back to the default order.
    const orderBy = query.sort === 'distance' && !query.origin ? ORDER_BY.closing : ORDER_BY[query.sort];

    const rows = this.db
      .prepare(`${SELECT_WITH_BIDDER} ${where} ORDER BY ${orderBy}, v.lot ASC LIMIT @limit OFFSET @offset`)
      .all(params) as VehicleWithBidderRow[];

    const { total } = this.db
      .prepare(`SELECT COUNT(*) AS total ${FROM_WITH_BIDDER} ${where}`)
      .get(params) as { total: number };

    // Tab counts honour every filter except the status tab itself.
    return { rows, total, statusCounts: this.statusCounts(clauses, params) };
  }

  /** How many lots match, honouring the status tab — used for saved-search badges. */
  count(query: VehicleQuery, bidderId: string | null, now: number): number {
    const { clauses, params } = buildFilters(query);
    Object.assign(params, contextParams(bidderId, now, null));
    const statusClause = STATUS_CLAUSE[query.status];
    const where = whereSql(statusClause ? [...clauses, statusClause] : clauses);
    const { total } = this.db.prepare(`SELECT COUNT(*) AS total ${FROM_WITH_BIDDER} ${where}`).get(params) as {
      total: number;
    };
    return total;
  }

  findWithBidder(id: string, bidderId: string | null, origin: BuyerOrigin | null = null): VehicleWithBidderRow | undefined {
    return this.db
      .prepare(`${SELECT_WITH_BIDDER} WHERE v.id = @id`)
      .get({ id, ...contextParams(bidderId, 0, origin) }) as VehicleWithBidderRow | undefined;
  }

  findRow(id: string): VehicleRow | undefined {
    return this.db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as VehicleRow | undefined;
  }

  exists(id: string): boolean {
    return this.db.prepare('SELECT 1 FROM vehicles WHERE id = ?').get(id) !== undefined;
  }

  /**
   * Filter options with counts that follow the buyer's other choices. Each group is
   * counted with every filter except its own, so after ticking Ford the body styles
   * show how many Ford trucks there are, while the other makes stay selectable.
   */
  facets(query: FacetQuery, bidderId: string | null, now: number): FacetsDto {
    const context = contextParams(bidderId, now, null);
    const statusClause = STATUS_CLAUSE[query.status];
    const filtered = (overrides: Partial<FacetQuery>) => {
      const { clauses, params } = buildFilters({ ...query, ...overrides });
      return {
        where: whereSql(statusClause ? [...clauses, statusClause] : clauses),
        params: { ...params, ...context },
      };
    };

    const options = (key: FacetKey): FacetOptionDto[] => {
      const column = FACET_COLUMNS[key];
      const values = this.db
        .prepare(`SELECT DISTINCT ${column} AS value FROM vehicles v ORDER BY value`)
        .all() as { value: string }[];
      const { where, params } = filtered({ [key]: undefined });
      const counts = this.db
        .prepare(`SELECT ${column} AS value, COUNT(*) AS count ${FROM_WITH_BIDDER} ${where} GROUP BY ${column}`)
        .all(params) as FacetOptionDto[];
      const byValue = new Map(counts.map((row) => [row.value, row.count]));
      // Every option is listed, so a choice never vanishes; zero just means "none with your other filters".
      return values.map(({ value }) => ({ value, count: byValue.get(value) ?? 0 }));
    };

    const countWith = (overrides: Partial<FacetQuery>): number => {
      const { where, params } = filtered(overrides);
      return (this.db.prepare(`SELECT COUNT(*) AS total ${FROM_WITH_BIDDER} ${where}`).get(params) as { total: number })
        .total;
    };

    const ranges = this.db
      .prepare(
        `SELECT MIN(year) AS yearMin, MAX(year) AS yearMax,
                MIN(starting_bid) AS priceMin, MAX(COALESCE(buy_now_price, current_bid, starting_bid)) AS priceMax,
                MAX(odometer_km) AS kmMax
         FROM vehicles`,
      )
      .get() as { yearMin: number; yearMax: number; priceMin: number; priceMax: number; kmMax: number };

    return {
      makes: options('makes'),
      bodyStyles: options('bodyStyles'),
      fuelTypes: options('fuelTypes'),
      provinces: options('provinces'),
      titleStatuses: options('titleStatuses'),
      year: { min: ranges.yearMin, max: ranges.yearMax },
      price: { min: ranges.priceMin, max: ranges.priceMax },
      odometer: { max: ranges.kmMax },
      flags: {
        buyNow: countWith({ buyNowOnly: true }),
        noReserve: countWith({ noReserveOnly: true }),
        watched: bidderId === null ? 0 : countWith({ watchedOnly: true }),
      },
      totals: this.statusCounts([], context),
    };
  }

  private statusCounts(clauses: string[], params: Record<string, unknown>): StatusCountsDto {
    const counts = this.db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN ${IS_OPEN} THEN 1 ELSE 0 END), 0) AS open,
           COALESCE(SUM(CASE WHEN ${IS_OPEN} AND v.closes_at <= @soon THEN 1 ELSE 0 END), 0) AS closingSoon,
           COUNT(*) AS totalCount
         ${FROM_WITH_BIDDER} ${whereSql(clauses)}`,
      )
      .get(params) as { open: number; closingSoon: number; totalCount: number };
    return {
      open: counts.open,
      closingSoon: counts.closingSoon,
      ended: counts.totalCount - counts.open,
      all: counts.totalCount,
    };
  }

  applyBid(id: string, bid: { amount: number; bidderId: string; closesAt: number }): void {
    this.db
      .prepare(
        `UPDATE vehicles
         SET current_bid = @amount, bid_count = bid_count + 1, high_bidder_id = @bidderId, closes_at = @closesAt
         WHERE id = @id`,
      )
      .run({ id, ...bid });
  }

  applyBuyNow(id: string, bidderId: string, now: number): void {
    this.db
      .prepare(
        `UPDATE vehicles
         SET current_bid = buy_now_price, bid_count = bid_count + 1, high_bidder_id = @bidderId,
             sold_via = 'buy_now', closes_at = @now
         WHERE id = @id`,
      )
      .run({ id, bidderId, now });
  }

  /** Lots whose timer ran out in (from, to] — used to announce closes. */
  findNaturallyClosedBetween(from: number, to: number): VehicleRow[] {
    return this.db
      .prepare('SELECT * FROM vehicles WHERE sold_via IS NULL AND closes_at > ? AND closes_at <= ?')
      .all(from, to) as VehicleRow[];
  }

  findOpen(now: number): VehicleRow[] {
    return this.db
      .prepare('SELECT * FROM vehicles WHERE sold_via IS NULL AND closes_at > ?')
      .all(now) as VehicleRow[];
  }
}

function buildFilters(query: FacetQuery): { clauses: string[]; params: Record<string, unknown> } {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  const terms = (query.q ?? '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  terms.forEach((term, index) => {
    clauses.push(`v.search_text LIKE @q${index} ESCAPE '\\'`);
    params[`q${index}`] = `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
  });

  const inList = (column: string, key: string, values?: string[]) => {
    if (!values?.length) return;
    const names = values.map((value, index) => {
      params[`${key}${index}`] = value;
      return `@${key}${index}`;
    });
    clauses.push(`${column} IN (${names.join(', ')})`);
  };
  inList('v.make', 'make', query.makes);
  inList('v.body_style', 'body', query.bodyStyles);
  inList('v.fuel_type', 'fuel', query.fuelTypes);
  inList('v.province', 'province', query.provinces);
  inList('v.title_status', 'title', query.titleStatuses);

  const compare = (sql: string, key: string, value?: number) => {
    if (value === undefined) return;
    clauses.push(sql);
    params[key] = value;
  };
  compare('v.condition_grade >= @minGrade', 'minGrade', query.minGrade);
  compare('v.odometer_km <= @maxKm', 'maxKm', query.maxKm);
  compare('v.year >= @yearMin', 'yearMin', query.yearMin);
  compare('v.year <= @yearMax', 'yearMax', query.yearMax);
  compare(`${CURRENT_PRICE} >= @priceMin`, 'priceMin', query.priceMin);
  compare(`${CURRENT_PRICE} <= @priceMax`, 'priceMax', query.priceMax);

  if (query.buyNowOnly) clauses.push('v.buy_now_price IS NOT NULL');
  if (query.noReserveOnly) clauses.push('v.reserve_price IS NULL');
  if (query.watchedOnly) clauses.push('w.vehicle_id IS NOT NULL');
  if (query.myBidsOnly) clauses.push('my.max_amount IS NOT NULL');
  compare('v.listed_at > @listedAfter', 'listedAfter', query.listedAfter);

  return { clauses, params };
}

/** Parameters every query shares: who is asking, when, and from where. */
function contextParams(bidderId: string | null, now: number, origin: BuyerOrigin | null | undefined) {
  return {
    bidderId: bidderId ?? '',
    now,
    soon: now + CLOSING_SOON_WINDOW_MS,
    hasOrigin: origin ? 1 : 0,
    originLat: origin?.lat ?? null,
    originLng: origin?.lng ?? null,
    roadKm: origin?.roadKm ? JSON.stringify(origin.roadKm) : null,
  };
}

function whereSql(clauses: string[]): string {
  return clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
}
