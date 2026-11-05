import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, timeout } from 'rxjs';
import { GeoPoint, roundCoordinate } from '../shared/geo';

/** A real place the buyer can use as their location: a city, address or postal/ZIP code. */
export interface Place extends GeoPoint {
  /** "Buffalo, NY", "N2G 4G7, Kitchener, ON", "16 Main Street, Halifax, NS" */
  label: string;
  /** Second line in suggestions, e.g. "United States". */
  detail: string;
}

/**
 * Photon (komoot) geocodes OpenStreetMap data, needs no API key and allows
 * browser calls, which keeps the prototype clone-and-run. It's the one swap
 * point if this went to production (a paid geocoder, or a proxy in the API).
 */
const PHOTON = 'https://photon.komoot.io';
/** Canada, the US and Mexico: where a Canadian wholesale buyer realistically is. */
const NORTH_AMERICA = '-170,14,-50,72';
const TIMEOUT_MS = 8000;

@Injectable({ providedIn: 'root' })
export class PlaceSearch {
  private readonly http = inject(HttpClient);

  /** Up to five places matching what the buyer typed. */
  search(text: string): Observable<Place[]> {
    const params = new HttpParams({ fromObject: { q: text, limit: 8, lang: 'en', bbox: NORTH_AMERICA } });
    return this.http.get<PhotonResponse>(`${PHOTON}/api/`, { params }).pipe(
      timeout(TIMEOUT_MS),
      map(({ features }) => uniqueByLabel(features.filter(isSpecific).map(toPlace)).slice(0, 5)),
    );
  }

  /** The town or city at a point. Only a ~1 km rounded position leaves the browser. */
  townAt(point: GeoPoint): Observable<Place | null> {
    const params = new HttpParams({
      fromObject: { lat: roundCoordinate(point.lat), lon: roundCoordinate(point.lng), lang: 'en' },
    });
    return this.http.get<PhotonResponse>(`${PHOTON}/reverse`, { params }).pipe(
      timeout(TIMEOUT_MS),
      map(({ features }) => (features[0] ? toTown(features[0], point) : null)),
    );
  }
}

export interface PhotonFeature {
  geometry: { coordinates: [lng: number, lat: number] };
  properties: {
    type?: string;
    osm_value?: string;
    name?: string;
    housenumber?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countrycode?: string;
  };
}

interface PhotonResponse {
  features: PhotonFeature[];
}

/** A whole state or country is too coarse to measure distance from. */
function isSpecific(feature: PhotonFeature): boolean {
  return feature.properties.type !== 'state' && feature.properties.type !== 'country';
}

/** One suggestion line, from the most specific part to the region. */
export function toPlace(feature: PhotonFeature): Place {
  const p = feature.properties;
  const [lng, lat] = feature.geometry.coordinates;
  // A named building or business keeps its name; otherwise "16 Main Street".
  const address = p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street;
  // A city is its own town; Photon also sends its county, which would only add noise.
  const town = p.type === 'city' ? undefined : (p.city ?? p.locality ?? p.county);
  return {
    lat,
    lng,
    label: joinUnique([p.name ?? address, town, regionCode(p.state, p.countrycode)]),
    detail: p.country ?? '',
  };
}

/** City-level label for a device position, e.g. "Buffalo, NY". Keeps the device's own coordinates. */
export function toTown(feature: PhotonFeature, point: GeoPoint): Place {
  const p = feature.properties;
  const town = p.city ?? (p.type === 'city' ? p.name : undefined) ?? p.locality ?? p.district ?? p.county;
  return { ...point, label: joinUnique([town, regionCode(p.state, p.countrycode)]), detail: p.country ?? '' };
}

/** Province and state codes for Canada and the US ("ON", "NY"); the country name elsewhere. */
export function regionCode(state: string | undefined, countryCode: string | undefined): string | undefined {
  if (!state) return undefined;
  const code = REGION_CODES[countryCode?.toUpperCase() ?? '']?.[state];
  return code ?? state;
}

function joinUnique(parts: (string | undefined)[]): string {
  return [...new Set(parts.filter((part): part is string => !!part?.trim()))].join(', ');
}

function uniqueByLabel(places: Place[]): Place[] {
  const seen = new Set<string>();
  return places.filter((place) => place.label && !seen.has(place.label) && seen.add(place.label));
}

const REGION_CODES: Record<string, Record<string, string>> = {
  CA: {
    Alberta: 'AB',
    'British Columbia': 'BC',
    Manitoba: 'MB',
    'New Brunswick': 'NB',
    'Newfoundland and Labrador': 'NL',
    'Northwest Territories': 'NT',
    'Nova Scotia': 'NS',
    Nunavut: 'NU',
    Ontario: 'ON',
    'Prince Edward Island': 'PE',
    Quebec: 'QC',
    Québec: 'QC',
    Saskatchewan: 'SK',
    Yukon: 'YT',
  },
  US: {
    Alabama: 'AL',
    Alaska: 'AK',
    Arizona: 'AZ',
    Arkansas: 'AR',
    California: 'CA',
    Colorado: 'CO',
    Connecticut: 'CT',
    Delaware: 'DE',
    'District of Columbia': 'DC',
    Florida: 'FL',
    Georgia: 'GA',
    Hawaii: 'HI',
    Idaho: 'ID',
    Illinois: 'IL',
    Indiana: 'IN',
    Iowa: 'IA',
    Kansas: 'KS',
    Kentucky: 'KY',
    Louisiana: 'LA',
    Maine: 'ME',
    Maryland: 'MD',
    Massachusetts: 'MA',
    Michigan: 'MI',
    Minnesota: 'MN',
    Mississippi: 'MS',
    Missouri: 'MO',
    Montana: 'MT',
    Nebraska: 'NE',
    Nevada: 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    Ohio: 'OH',
    Oklahoma: 'OK',
    Oregon: 'OR',
    Pennsylvania: 'PA',
    'Puerto Rico': 'PR',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    Tennessee: 'TN',
    Texas: 'TX',
    Utah: 'UT',
    Vermont: 'VT',
    Virginia: 'VA',
    Washington: 'WA',
    'West Virginia': 'WV',
    Wisconsin: 'WI',
    Wyoming: 'WY',
  },
};
