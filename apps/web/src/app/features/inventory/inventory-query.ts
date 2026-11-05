import { Params } from '@angular/router';
import { formatKm, formatMoney, humanize, provinceCode } from '../../shared/format';

/**
 * Inventory filters live in the URL so results are shareable, survive refresh,
 * and the back button returns to exactly the list the buyer left.
 */

export const STATUS_TABS = ['open', 'closing_soon', 'ended', 'all'] as const;
export type StatusTab = (typeof STATUS_TABS)[number];

export const SORT_OPTIONS = [
  { value: 'closing', label: 'Ending soon' },
  { value: 'listed_desc', label: 'Newly listed' },
  { value: 'km_asc', label: 'Lowest mileage' },
  { value: 'distance', label: 'Closest to me' },
  { value: 'price_asc', label: 'Lowest price' },
  { value: 'price_desc', label: 'Highest price' },
  { value: 'year_desc', label: 'Newest model year' },
  { value: 'bids_desc', label: 'Most bids' },
  { value: 'grade_desc', label: 'Best condition' },
] as const;
export type SortKey = (typeof SORT_OPTIONS)[number]['value'];

/**
 * One-tap views across the top of the results (the pattern buyers know from
 * consumer auction sites). They're mutually exclusive: "No reserve" is
 * ending-soon order limited to no-reserve lots; the rest are sorts.
 */
export const QUICK_SORTS = [
  { id: 'closing', label: 'Ending soon' },
  { id: 'listed_desc', label: 'Newly listed' },
  { id: 'no_reserve', label: 'No reserve' },
  { id: 'km_asc', label: 'Lowest mileage' },
  { id: 'distance', label: 'Closest to me' },
] as const;
export type QuickSortId = (typeof QUICK_SORTS)[number]['id'];

/** Sorts that don't have a quick tab, offered in the "More sorts" menu. */
export const MORE_SORTS = SORT_OPTIONS.filter((option) => !QUICK_SORTS.some((quick) => quick.id === option.value));

export function activeQuickSort(query: InventoryQuery): QuickSortId | null {
  if (query.noReserve && query.sort === 'closing') return 'no_reserve';
  return QUICK_SORTS.find((quick) => quick.id === query.sort)?.id ?? null;
}

export function applyQuickSort(query: InventoryQuery, id: QuickSortId): InventoryQuery {
  if (id === 'no_reserve') return { ...query, sort: 'closing', noReserve: true };
  return applySort(query, id);
}

/** Changes the sort. Leaving the "No reserve" tab this way also drops the filter that tab turned on. */
export function applySort(query: InventoryQuery, sort: SortKey): InventoryQuery {
  const leavingNoReserve = activeQuickSort(query) === 'no_reserve';
  return { ...query, sort, noReserve: leavingNoReserve ? false : query.noReserve };
}

export const LIST_FILTERS = ['make', 'bodyStyle', 'fuelType', 'province', 'titleStatus'] as const;
export type ListFilter = (typeof LIST_FILTERS)[number];

export const NUMBER_FILTERS = ['priceMax', 'yearMin', 'maxKm', 'minGrade'] as const;
export type NumberFilter = (typeof NUMBER_FILTERS)[number];

export const FLAG_FILTERS = ['buyNow', 'noReserve', 'watched'] as const;
export type FlagFilter = (typeof FLAG_FILTERS)[number];

export type InventoryQuery = {
  q: string;
  status: StatusTab;
  sort: SortKey;
} & Record<ListFilter, string[]> &
  Record<NumberFilter, number | null> &
  Record<FlagFilter, boolean>;

export const DEFAULT_QUERY: InventoryQuery = {
  q: '',
  status: 'open',
  sort: 'closing',
  make: [],
  bodyStyle: [],
  fuelType: [],
  province: [],
  titleStatus: [],
  priceMax: null,
  yearMin: null,
  maxKm: null,
  minGrade: null,
  buyNow: false,
  noReserve: false,
  watched: false,
};

export function parseInventoryQuery(params: Params): InventoryQuery {
  const query: InventoryQuery = { ...DEFAULT_QUERY };

  query.q = typeof params['q'] === 'string' ? params['q'] : '';
  query.status = oneOf(params['status'], STATUS_TABS, DEFAULT_QUERY.status);
  query.sort = oneOf(params['sort'], SORT_OPTIONS.map((option) => option.value), DEFAULT_QUERY.sort);

  for (const key of LIST_FILTERS) {
    const raw = params[key];
    const values: string[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
    query[key] = values.map((value) => value.trim()).filter(Boolean);
  }
  for (const key of NUMBER_FILTERS) {
    const value = Number(params[key]);
    query[key] = params[key] !== undefined && Number.isFinite(value) ? value : null;
  }
  for (const key of FLAG_FILTERS) {
    query[key] = params[key] === 'true';
  }
  return query;
}

/** Router query params: defaults are dropped (null removes the param) to keep URLs short. */
export function toRouteParams(query: InventoryQuery): Params {
  const params: Params = {
    q: query.q.trim() || null,
    status: query.status === DEFAULT_QUERY.status ? null : query.status,
    sort: query.sort === DEFAULT_QUERY.sort ? null : query.sort,
  };
  for (const key of LIST_FILTERS) params[key] = query[key].length ? query[key].join(',') : null;
  for (const key of NUMBER_FILTERS) params[key] = query[key];
  for (const key of FLAG_FILTERS) params[key] = query[key] ? 'true' : null;
  return params;
}

/** Params for GET /api/vehicles (only non-empty values). */
export function toApiParams(query: InventoryQuery): Record<string, string> {
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(toRouteParams(query))) {
    if (value !== null && value !== undefined) params[key] = String(value);
  }
  params['status'] = query.status;
  params['sort'] = query.sort;
  return params;
}

/** How many filters are applied (search and sort aside) — shown on the Filters button. */
export function activeFilterCount(query: InventoryQuery): number {
  return appliedFilters(query).filter((filter) => filter.id !== 'q').length;
}

/** One removable chip above the results. */
export interface AppliedFilter {
  /** Stable identity, e.g. "make:Ford". */
  id: string;
  label: string;
  /** The same search with just this filter removed. */
  without: InventoryQuery;
}

const LIST_LABELS: Record<ListFilter, (value: string) => string> = {
  make: (value) => value,
  bodyStyle: humanize,
  fuelType: humanize,
  titleStatus: (value) => `${humanize(value)} title`,
  province: (value) => value,
};

/**
 * Everything narrowing the results, as chips the buyer can remove one at a time.
 * Sort isn't a filter, so it isn't here; nor is "No reserve" while its tab is
 * showing it (the tab already says so).
 */
export function appliedFilters(query: InventoryQuery): AppliedFilter[] {
  const chips: AppliedFilter[] = [];
  const add = (id: string, label: string, patch: Partial<InventoryQuery>) =>
    chips.push({ id, label, without: { ...query, ...patch } });

  if (query.q.trim()) add('q', `“${query.q.trim()}”`, { q: '' });
  if (query.status !== DEFAULT_QUERY.status) add('status', STATUS_LABELS[query.status], { status: DEFAULT_QUERY.status });
  for (const key of LIST_FILTERS) {
    for (const value of query[key]) {
      add(`${key}:${value}`, LIST_LABELS[key](value), { [key]: query[key].filter((item) => item !== value) });
    }
  }
  if (query.priceMax !== null) add('priceMax', `Under ${formatMoney(query.priceMax)}`, { priceMax: null });
  if (query.yearMin !== null) add('yearMin', `${query.yearMin} or newer`, { yearMin: null });
  if (query.maxKm !== null) add('maxKm', `Under ${formatKm(query.maxKm)}`, { maxKm: null });
  if (query.minGrade !== null) add('minGrade', `Grade ${query.minGrade}+`, { minGrade: null });
  if (query.buyNow) add('buyNow', 'Buy Now', { buyNow: false });
  if (query.noReserve && activeQuickSort(query) !== 'no_reserve') add('noReserve', 'No reserve', { noReserve: false });
  if (query.watched) add('watched', 'Watching', { watched: false });
  return chips;
}

/**
 * Canonical identity of a search (sorted keys and values, defaults dropped),
 * so "is this search already saved?" ignores the order filters were picked in.
 */
export function searchKey(query: InventoryQuery): string {
  const entries = Object.entries(toRouteParams(query))
    .filter((entry): entry is [string, string | number] => entry[1] !== null && entry[1] !== undefined)
    .map(([key, value]) => {
      const text = String(value);
      return [key, (LIST_FILTERS as readonly string[]).includes(key) ? text.split(',').sort().join(',') : text] as const;
    })
    .sort(([a], [b]) => a.localeCompare(b));
  return new URLSearchParams(entries.map(([key, value]) => [key, value])).toString();
}

/** True when nothing has been searched, filtered, sorted or tabbed — there's nothing worth saving. */
export function isDefaultQuery(query: InventoryQuery): boolean {
  return searchKey(query) === '';
}

/** URL params for a saved search, as plain strings (what the API stores). */
export function toSavedParams(query: InventoryQuery): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(searchKey(query)));
}

const STATUS_LABELS: Record<StatusTab, string> = {
  open: 'Open',
  closing_soon: 'Closing in 24h',
  ended: 'Ended',
  all: 'All lots',
};

/** Label for the current sort, for the compact sort menu button. */
export function sortLabel(query: InventoryQuery): string {
  const quick = activeQuickSort(query);
  if (quick) return QUICK_SORTS.find((option) => option.id === quick)!.label;
  return SORT_OPTIONS.find((option) => option.value === query.sort)?.label ?? 'Sort';
}

/** Plain-language summary of a search, e.g. ["“bronco”", "Ford", "Truck", "Under $30,000"]. */
export function describeQuery(query: InventoryQuery): string[] {
  const parts: string[] = [];
  const list = (values: string[], format: (value: string) => string = (value) => value) =>
    values.length > 2 ? `${format(values[0])} +${values.length - 1}` : values.map(format).join(', ');

  if (query.q.trim()) parts.push(`“${query.q.trim()}”`);
  if (query.make.length) parts.push(list(query.make));
  if (query.bodyStyle.length) parts.push(list(query.bodyStyle, humanize));
  if (query.fuelType.length) parts.push(list(query.fuelType, humanize));
  if (query.titleStatus.length) parts.push(`${list(query.titleStatus, humanize)} title`);
  if (query.province.length) parts.push(list(query.province, provinceCode));
  if (query.priceMax !== null) parts.push(`Under ${formatMoney(query.priceMax)}`);
  if (query.yearMin !== null) parts.push(`${query.yearMin} or newer`);
  if (query.maxKm !== null) parts.push(`Under ${formatKm(query.maxKm)}`);
  if (query.minGrade !== null) parts.push(`Grade ${query.minGrade}+`);
  if (query.buyNow) parts.push('Buy Now');
  if (query.noReserve) parts.push('No reserve');
  if (query.watched) parts.push('Watched');
  if (query.status !== DEFAULT_QUERY.status) parts.push(STATUS_LABELS[query.status]);
  if (query.sort !== DEFAULT_QUERY.sort) {
    parts.push(SORT_OPTIONS.find((option) => option.value === query.sort)?.label ?? query.sort);
  }
  return parts;
}

/** A sensible default name for a saved search. */
export function suggestSearchName(query: InventoryQuery): string {
  const parts = describeQuery(query);
  return parts.length ? parts.slice(0, 3).join(' · ') : 'All open lots';
}

/** Clears every filter, keeping the search text and sort (and the "No reserve" tab, if that's the view). */
export function clearFilters(query: InventoryQuery): InventoryQuery {
  return {
    ...DEFAULT_QUERY,
    q: query.q,
    sort: query.sort,
    noReserve: activeQuickSort(query) === 'no_reserve',
  };
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}
