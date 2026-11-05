/**
 * A rough book value for a lot, in the spirit of a valuation guide: a typical
 * price for the model's segment, depreciated by age, then adjusted for mileage,
 * condition grade and title.
 *
 * This is a prototype stand-in for a real valuation feed (a guide like Canadian
 * Black Book, or the marketplace's own sale prices). It is deterministic and
 * explainable, and deliberately ignores the seller's private reserve, so showing
 * it never leaks what the seller will accept.
 */

export interface MarketValueInput {
  year: number;
  make: string;
  model: string;
  odometerKm: number;
  conditionGrade: number;
  titleStatus: string;
}

export interface MarketValue {
  /** Best single estimate, rounded to $100. */
  value: number;
  /** Typical range either side of the estimate, rounded to $250. */
  low: number;
  high: number;
}

/** Typical price of a recent example of each segment (CAD). First match wins. */
const SEGMENTS: ReadonlyArray<{ base: number; matches: (make: string, model: string) => boolean }> = [
  { base: 102_500, matches: (make, model) => make === 'Tesla' && model === 'Model S' },
  { base: 62_500, matches: (make) => make === 'Tesla' },
  { base: 80_000, matches: (make, model) => make === 'BMW' && ['X5', '5 Series'].includes(model) },
  { base: 59_000, matches: (make) => make === 'BMW' },
  { base: 65_000, matches: (_, model) => ['F-150', 'Silverado 1500', 'Sierra 1500', '1500', 'Tundra'].includes(model) },
  { base: 46_500, matches: (_, model) => model === 'Tacoma' },
  {
    base: 57_500,
    matches: (_, model) => ['Grand Cherokee', 'Telluride', 'Highlander', 'Pilot', 'Explorer'].includes(model),
  },
  {
    base: 40_000,
    matches: (_, model) =>
      [
        'CR-V',
        'RAV4',
        'Tucson',
        'Sportage',
        'Equinox',
        'Escape',
        'CX-5',
        'Crosstrek',
        'Rogue',
        'Tiguan',
        'Terrain',
        'Bronco',
      ].includes(model),
  },
  { base: 45_000, matches: (_, model) => ['Mustang', 'WRX', 'Golf GTI'].includes(model) },
  { base: 51_000, matches: (_, model) => model === 'Wrangler' },
];
const DEFAULT_BASE = 32_500;

const KM_PER_YEAR = 18_000;
const TITLE_FACTOR: Record<string, number> = { clean: 1, rebuilt: 0.68, salvage: 0.45 };
const RANGE = 0.07;

export function segmentBase(make: string, model: string): number {
  return SEGMENTS.find((segment) => segment.matches(make, model))?.base ?? DEFAULT_BASE;
}

/** Share of the segment price a vehicle keeps at a given age (steepest in the first two years). */
export function depreciation(ageYears: number): number {
  if (ageYears <= 0) return 0.92;
  if (ageYears === 1) return 0.82;
  if (ageYears === 2) return 0.73;
  return Math.max(0.3, 0.73 - (ageYears - 2) * 0.055);
}

/** Low mileage for the age earns a premium; well above average costs more the further it goes. */
export function mileageFactor(odometerKm: number, ageYears: number): number {
  const expected = Math.max(ageYears * KM_PER_YEAR, 5_000);
  const ratio = odometerKm / expected;
  if (ratio < 0.8) return 1.05;
  if (ratio < 1.2) return 1;
  if (ratio < 1.5) return 0.92;
  return 0.8;
}

/** Grade 5 adds 5%; grade 1 takes off about a quarter. */
export function conditionFactor(grade: number): number {
  return 0.7 + (grade / 5) * 0.35;
}

export function estimateMarketValue(vehicle: MarketValueInput, currentYear: number): MarketValue {
  const age = Math.max(0, currentYear - vehicle.year);
  const raw =
    segmentBase(vehicle.make, vehicle.model) *
    depreciation(age) *
    mileageFactor(vehicle.odometerKm, age) *
    conditionFactor(vehicle.conditionGrade) *
    (TITLE_FACTOR[vehicle.titleStatus] ?? 1);

  const value = roundTo(raw, 100);
  return {
    value,
    low: roundTo(value * (1 - RANGE), 250),
    high: roundTo(value * (1 + RANGE), 250),
  };
}

function roundTo(amount: number, step: number): number {
  return Math.round(amount / step) * step;
}
