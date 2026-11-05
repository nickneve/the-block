import { distanceKm, parseGeoPoint } from './geo';

describe('distanceKm', () => {
  it('measures great-circle distance between Canadian cities', () => {
    const toronto = { lat: 43.653, lng: -79.383 };
    const montreal = { lat: 45.502, lng: -73.567 };
    expect(distanceKm(toronto, montreal)).toBeGreaterThan(495);
    expect(distanceKm(toronto, montreal)).toBeLessThan(515);
  });

  it('is zero for the same point and symmetric', () => {
    const a = { lat: 49.283, lng: -123.121 };
    const b = { lat: 44.649, lng: -63.575 };
    expect(distanceKm(a, a)).toBe(0);
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 6);
  });
});

describe('parseGeoPoint', () => {
  it('reads "lat,lng"', () => {
    expect(parseGeoPoint('43.45,-80.49')).toEqual({ lat: 43.45, lng: -80.49 });
    expect(parseGeoPoint(' 43.45 , -80.49 ')).toEqual({ lat: 43.45, lng: -80.49 });
  });

  it.each([undefined, '', 'Toronto', '43.45', '43.45,-80.49,1', 'abc,def', '91,0', '0,181'])(
    'ignores %p',
    (value) => {
      expect(parseGeoPoint(value)).toBeNull();
    },
  );
});
