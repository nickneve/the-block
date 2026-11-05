import { canonicalSearchParams, fromQueryString, toQueryString } from './saved-search-query';

describe('canonicalSearchParams', () => {
  it('sorts keys and list values so the same search always has one identity', () => {
    const a = canonicalSearchParams({ make: 'Kia,Ford', bodyStyle: 'truck', sort: 'km_asc' });
    const b = canonicalSearchParams({ sort: 'km_asc', bodyStyle: 'truck', make: 'Ford,Kia' });
    expect(a).toEqual({ bodyStyle: 'truck', make: 'Ford,Kia', sort: 'km_asc' });
    expect(toQueryString(a)).toBe(toQueryString(b));
  });

  it('drops defaults, empty values and false flags', () => {
    expect(
      canonicalSearchParams({ q: '  ', status: 'open', sort: 'closing', buyNow: 'false', noReserve: 'true', priceMax: '30000' }),
    ).toEqual({ noReserve: 'true', priceMax: '30000' });
  });

  it('rejects unknown parameters and invalid values', () => {
    expect(() => canonicalSearchParams({ make: 'Ford', page: '2' })).toThrow(/Unknown search parameter: page/);
    expect(() => canonicalSearchParams({ sort: 'cheapest' })).toThrow(/sort must be one of/);
    expect(() => canonicalSearchParams({ minGrade: '9' })).toThrow();
  });

  it('round-trips through the stored query string', () => {
    const params = canonicalSearchParams({ q: 'f-150 lariat', make: 'Ford' });
    expect(fromQueryString(toQueryString(params))).toEqual(params);
  });
});
