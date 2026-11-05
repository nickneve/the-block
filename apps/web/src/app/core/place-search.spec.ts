import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { PhotonFeature, PlaceSearch, regionCode, toPlace, toTown } from './place-search';

const feature = (properties: PhotonFeature['properties'], lng = -78.88, lat = 42.89): PhotonFeature => ({
  geometry: { coordinates: [lng, lat] },
  properties,
});

describe('place labels', () => {
  it('labels a US city with its state code, without the county', () => {
    const place = toPlace(
      feature({
        type: 'city',
        name: 'Buffalo',
        county: 'Erie County',
        state: 'New York',
        country: 'United States',
        countrycode: 'US',
      }),
    );
    expect(place).toEqual({ lat: 42.89, lng: -78.88, label: 'Buffalo, NY', detail: 'United States' });
  });

  it('labels an address and a postal code with their town', () => {
    const house = feature({
      type: 'house',
      housenumber: '16',
      street: 'Main Street',
      city: 'Halifax',
      state: 'Nova Scotia',
      countrycode: 'CA',
    });
    const postcode = feature({
      type: 'other',
      name: 'N2G 4G7',
      city: 'Kitchener',
      state: 'Ontario',
      countrycode: 'CA',
    });
    expect(toPlace(house).label).toBe('16 Main Street, Halifax, NS');
    expect(toPlace(postcode).label).toBe('N2G 4G7, Kitchener, ON');
  });

  it("names the town around a device position but keeps the device's coordinates", () => {
    const nearby = feature({
      type: 'house',
      housenumber: '16',
      street: 'Rabin Terrace',
      district: 'Downtown',
      city: 'Buffalo',
      state: 'New York',
      countrycode: 'US',
    });
    expect(toTown(nearby, { lat: 42.8901, lng: -78.8812 })).toEqual({
      lat: 42.8901,
      lng: -78.8812,
      label: 'Buffalo, NY',
      detail: '',
    });
  });

  it('falls back to the full region name outside Canada and the US', () => {
    expect(regionCode('Jalisco', 'MX')).toBe('Jalisco');
    expect(regionCode('Québec', 'CA')).toBe('QC');
    expect(regionCode(undefined, 'CA')).toBeUndefined();
  });
});

describe('PlaceSearch', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('searches North America and drops whole states and duplicates', async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    const results = firstValueFrom(TestBed.inject(PlaceSearch).search('portland'));

    const request = http.expectOne((req) => req.url.endsWith('/api/'));
    expect(request.request.params.get('q')).toBe('portland');
    expect(request.request.params.get('bbox')).toBe('-170,14,-50,72');
    request.flush({
      features: [
        feature({ type: 'city', name: 'Portland', state: 'Oregon', countrycode: 'US' }),
        feature({ type: 'city', name: 'Portland', state: 'Oregon', countrycode: 'US' }),
        feature({ type: 'state', name: 'Oregon', countrycode: 'US' }),
        feature({ type: 'city', name: 'Portland', state: 'Maine', countrycode: 'US' }),
      ],
    });

    expect((await results).map((place) => place.label)).toEqual(['Portland, OR', 'Portland, ME']);
    http.verify();
  });

  it('only sends a rounded position when naming the town', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(PlaceSearch).townAt({ lat: 42.886417, lng: -78.878149 }).subscribe();

    const request = http.expectOne((req) => req.url.endsWith('/reverse'));
    expect(request.request.params.get('lat')).toBe('42.89');
    expect(request.request.params.get('lon')).toBe('-78.88');
    request.flush({ features: [] });
  });
});
