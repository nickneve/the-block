/**
 * Bump when the schema changes: an older local database is rebuilt from the
 * seed on startup instead of failing on a missing column.
 */
export const SCHEMA_VERSION = 2;

/**
 * Times are stored as epoch milliseconds (INTEGER) so comparisons against
 * "now" are cheap and timezone-free; the API serialises them as ISO strings.
 */
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS vehicles (
  id                 TEXT PRIMARY KEY,
  lot                TEXT NOT NULL UNIQUE,
  vin                TEXT NOT NULL,
  year               INTEGER NOT NULL,
  make               TEXT NOT NULL,
  model              TEXT NOT NULL,
  trim               TEXT NOT NULL,
  body_style         TEXT NOT NULL,
  exterior_color     TEXT NOT NULL,
  interior_color     TEXT NOT NULL,
  engine             TEXT NOT NULL,
  transmission       TEXT NOT NULL,
  drivetrain         TEXT NOT NULL,
  odometer_km        INTEGER NOT NULL,
  fuel_type          TEXT NOT NULL,
  condition_grade    REAL NOT NULL,
  condition_report   TEXT NOT NULL,
  damage_notes       TEXT NOT NULL,          -- JSON array of strings
  title_status       TEXT NOT NULL,
  province           TEXT NOT NULL,
  city               TEXT NOT NULL,
  latitude           REAL,                   -- dealership city, for "Closest to me"
  longitude          REAL,
  selling_dealership TEXT NOT NULL,
  images             TEXT NOT NULL,          -- JSON array of URLs
  search_text        TEXT NOT NULL,          -- lower-cased haystack for free-text search
  starting_bid       INTEGER NOT NULL,
  reserve_price      INTEGER,
  buy_now_price      INTEGER,
  listed_at          INTEGER NOT NULL,
  scheduled_close_at INTEGER NOT NULL,       -- normalised "runs on the block" time
  closes_at          INTEGER NOT NULL,       -- may move later via soft close
  current_bid        INTEGER,
  bid_count          INTEGER NOT NULL DEFAULT 0,
  high_bidder_id     TEXT,
  sold_via           TEXT CHECK (sold_via IN ('buy_now')),
  market_ceiling     INTEGER NOT NULL        -- simulator only: rivals stop bidding here
);

CREATE INDEX IF NOT EXISTS idx_vehicles_closes_at ON vehicles (closes_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_listed_at ON vehicles (listed_at);

CREATE TABLE IF NOT EXISTS bids (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  vehicle_id TEXT NOT NULL REFERENCES vehicles (id),
  bidder_id  TEXT NOT NULL,
  amount     INTEGER NOT NULL,
  placed_at  INTEGER NOT NULL,
  kind       TEXT NOT NULL DEFAULT 'bid' CHECK (kind IN ('bid', 'buy_now')),
  source     TEXT NOT NULL CHECK (source IN ('seed', 'user', 'sim'))
);

CREATE INDEX IF NOT EXISTS idx_bids_vehicle ON bids (vehicle_id, placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bids_bidder ON bids (bidder_id, vehicle_id);

CREATE TABLE IF NOT EXISTS watchlist (
  bidder_id  TEXT NOT NULL,
  vehicle_id TEXT NOT NULL REFERENCES vehicles (id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (bidder_id, vehicle_id)
);

CREATE TABLE IF NOT EXISTS saved_searches (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  bidder_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  query      TEXT NOT NULL,                  -- canonical query string, e.g. "make=Ford&sort=km_asc"
  created_at INTEGER NOT NULL,
  UNIQUE (bidder_id, query)
);
`;

export const TABLES = ['saved_searches', 'watchlist', 'bids', 'vehicles'] as const;
