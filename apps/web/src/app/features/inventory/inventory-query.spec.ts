import {
  activeFilterCount,
  activeQuickSort,
  appliedFilters,
  applyQuickSort,
  applySort,
  clearFilters,
  DEFAULT_QUERY,
  describeQuery,
  isDefaultQuery,
  MORE_SORTS,
  parseInventoryQuery,
  searchKey,
  sortLabel,
  suggestSearchName,
  toApiParams,
  toRouteParams,
  toSavedParams,
} from './inventory-query';

describe('inventory query ⇄ URL', () => {
  it('falls back to defaults for an empty URL', () => {
    expect(parseInventoryQuery({})).toEqual(DEFAULT_QUERY);
  });

  it('parses lists, numbers and flags from the URL', () => {
    const query = parseInventoryQuery({
      q: 'bronco',
      status: 'ended',
      sort: 'price_asc',
      make: 'Ford,Toyota',
      priceMax: '30000',
      buyNow: 'true',
    });

    expect(query).toMatchObject({
      q: 'bronco',
      status: 'ended',
      sort: 'price_asc',
      make: ['Ford', 'Toyota'],
      priceMax: 30000,
      buyNow: true,
      noReserve: false,
    });
  });

  it('ignores values it does not recognise', () => {
    const query = parseInventoryQuery({ status: 'bogus', sort: 'cheapest', priceMax: 'lots' });
    expect(query.status).toBe('open');
    expect(query.sort).toBe('closing');
    expect(query.priceMax).toBeNull();
  });

  it('round-trips through route params', () => {
    const query = { ...DEFAULT_QUERY, q: 'civic', make: ['Honda'], minGrade: 3.5, noReserve: true, status: 'all' as const };
    const params = toRouteParams(query);
    const cleaned = Object.fromEntries(Object.entries(params).filter(([, value]) => value !== null));
    expect(parseInventoryQuery(cleaned)).toEqual(query);
  });

  it('drops defaults from the URL to keep it short', () => {
    const params = toRouteParams(DEFAULT_QUERY);
    expect(Object.values(params).every((value) => value === null)).toBe(true);
  });

  it('always sends status and sort to the API', () => {
    expect(toApiParams(DEFAULT_QUERY)).toEqual({ status: 'open', sort: 'closing' });
  });
});

describe('applied filters', () => {
  const busy = {
    ...DEFAULT_QUERY,
    q: 'ford',
    status: 'ended' as const,
    sort: 'price_asc' as const,
    make: ['Ford', 'Ram'],
    titleStatus: ['salvage'],
    maxKm: 50000,
    watched: true,
  };

  it('lists each filter as a removable chip, in reading order', () => {
    expect(appliedFilters(busy).map((chip) => chip.label)).toEqual([
      '“ford”',
      'Ended',
      'Ford',
      'Ram',
      'Salvage title',
      'Under 50,000 km',
      'Watching',
    ]);
  });

  it('removes just one value when a chip is dismissed', () => {
    const ford = appliedFilters(busy).find((chip) => chip.id === 'make:Ford')!;
    expect(ford.without.make).toEqual(['Ram']);
    expect(ford.without.titleStatus).toEqual(['salvage']);
  });

  it('counts filters for the Filters button, but not the search text', () => {
    expect(activeFilterCount(busy)).toBe(6);
    expect(activeFilterCount(DEFAULT_QUERY)).toBe(0);
  });

  it('leaves "No reserve" to its tab when the tab is showing it', () => {
    expect(appliedFilters(applyQuickSort(DEFAULT_QUERY, 'no_reserve'))).toEqual([]);
    expect(appliedFilters({ ...DEFAULT_QUERY, sort: 'km_asc', noReserve: true })[0].label).toBe('No reserve');
  });

  it('clears filters and status while keeping the search text and sort', () => {
    expect(clearFilters(busy)).toEqual({ ...DEFAULT_QUERY, q: 'ford', sort: 'price_asc' });
    // On the "No reserve" tab, clearing filters stays on that tab.
    const onTab = { ...applyQuickSort(DEFAULT_QUERY, 'no_reserve'), make: ['Kia'] };
    expect(activeQuickSort(clearFilters(onTab))).toBe('no_reserve');
  });
});

describe('quick sorts', () => {
  it('highlights the tab matching the current sort', () => {
    expect(activeQuickSort(DEFAULT_QUERY)).toBe('closing');
    expect(activeQuickSort({ ...DEFAULT_QUERY, sort: 'listed_desc' })).toBe('listed_desc');
    expect(activeQuickSort({ ...DEFAULT_QUERY, sort: 'price_asc' })).toBeNull();
  });

  it('treats "No reserve" as ending-soon order limited to no-reserve lots', () => {
    const noReserve = applyQuickSort({ ...DEFAULT_QUERY, sort: 'km_asc' }, 'no_reserve');
    expect(noReserve).toMatchObject({ sort: 'closing', noReserve: true });
    expect(activeQuickSort(noReserve)).toBe('no_reserve');
  });

  it('drops the no-reserve filter when leaving that tab, but keeps one set from the filter panel', () => {
    const fromTab = applyQuickSort(applyQuickSort(DEFAULT_QUERY, 'no_reserve'), 'listed_desc');
    expect(fromTab).toMatchObject({ sort: 'listed_desc', noReserve: false });

    const fromPanel = applyQuickSort({ ...DEFAULT_QUERY, sort: 'price_asc', noReserve: true }, 'km_asc');
    expect(fromPanel).toMatchObject({ sort: 'km_asc', noReserve: true });
  });

  it('drops the no-reserve filter when leaving that tab through More sorts too', () => {
    expect(applySort(applyQuickSort(DEFAULT_QUERY, 'no_reserve'), 'price_desc')).toMatchObject({
      sort: 'price_desc',
      noReserve: false,
    });
  });

  it('names the current sort for the compact sort button', () => {
    expect(sortLabel(DEFAULT_QUERY)).toBe('Ending soon');
    expect(sortLabel(applyQuickSort(DEFAULT_QUERY, 'no_reserve'))).toBe('No reserve');
    expect(sortLabel({ ...DEFAULT_QUERY, sort: 'price_desc' })).toBe('Highest price');
  });

  it('offers every other sort under "More sorts"', () => {
    expect(MORE_SORTS.map((option) => option.value)).toEqual(['price_asc', 'price_desc', 'year_desc', 'bids_desc', 'grade_desc']);
  });
});

describe('saved search identity', () => {
  it('ignores the order filters were picked in', () => {
    const a = { ...DEFAULT_QUERY, make: ['Kia', 'Ford'], bodyStyle: ['SUV'] };
    const b = { ...DEFAULT_QUERY, bodyStyle: ['SUV'], make: ['Ford', 'Kia'] };
    expect(searchKey(a)).toBe(searchKey(b));
    expect(searchKey(a)).toBe('bodyStyle=SUV&make=Ford%2CKia');
  });

  it('matches a saved search returned by the API', () => {
    const query = { ...DEFAULT_QUERY, q: 'civic', priceMax: 20000, sort: 'km_asc' as const };
    const fromApi = parseInventoryQuery(toSavedParams(query));
    expect(searchKey(fromApi)).toBe(searchKey(query));
  });

  it('has nothing to save for the default view', () => {
    expect(isDefaultQuery(DEFAULT_QUERY)).toBe(true);
    expect(isDefaultQuery({ ...DEFAULT_QUERY, sort: 'listed_desc' })).toBe(false);
  });
});

describe('describeQuery', () => {
  it('summarises a search in plain language', () => {
    const query = {
      ...DEFAULT_QUERY,
      q: ' bronco ',
      make: ['Ford'],
      bodyStyle: ['truck'],
      titleStatus: ['clean'],
      priceMax: 30000,
      noReserve: true,
      sort: 'listed_desc' as const,
    };
    expect(describeQuery(query)).toEqual([
      '“bronco”',
      'Ford',
      'Truck',
      'Clean title',
      'Under $30,000',
      'No reserve',
      'Newly listed',
    ]);
  });

  it('suggests a short name from the first few criteria', () => {
    expect(suggestSearchName({ ...DEFAULT_QUERY, make: ['Ford', 'Kia', 'Ram'], fuelType: ['electric'] })).toBe('Ford +2 · Electric');
    expect(suggestSearchName(DEFAULT_QUERY)).toBe('All open lots');
  });
});
