import type { GeoPoint } from '../../common/geo';

/**
 * Approximate city-centre coordinates for every dealership city in
 * data/vehicles.json, so "Closest to me" can rank lots by distance.
 * A city missing from this table simply has no distance (sorted last).
 */
export const CITY_COORDINATES: Readonly<Record<string, GeoPoint>> = {
  'Abbotsford, British Columbia': { lat: 49.052, lng: -122.329 },
  'Burnaby, British Columbia': { lat: 49.249, lng: -122.98 },
  'Kelowna, British Columbia': { lat: 49.888, lng: -119.496 },
  'Langley, British Columbia': { lat: 49.104, lng: -122.66 },
  'Richmond, British Columbia': { lat: 49.166, lng: -123.134 },
  'Surrey, British Columbia': { lat: 49.191, lng: -122.849 },
  'Vancouver, British Columbia': { lat: 49.283, lng: -123.121 },
  'Victoria, British Columbia': { lat: 48.428, lng: -123.366 },
  'Airdrie, Alberta': { lat: 51.292, lng: -114.014 },
  'Calgary, Alberta': { lat: 51.045, lng: -114.072 },
  'Edmonton, Alberta': { lat: 53.546, lng: -113.494 },
  'Lethbridge, Alberta': { lat: 49.694, lng: -112.833 },
  'Red Deer, Alberta': { lat: 52.268, lng: -113.811 },
  'Regina, Saskatchewan': { lat: 50.445, lng: -104.619 },
  'Saskatoon, Saskatchewan': { lat: 52.157, lng: -106.671 },
  'Brandon, Manitoba': { lat: 49.848, lng: -99.95 },
  'Winnipeg, Manitoba': { lat: 49.895, lng: -97.138 },
  'Barrie, Ontario': { lat: 44.389, lng: -79.69 },
  'Brampton, Ontario': { lat: 43.731, lng: -79.762 },
  'Hamilton, Ontario': { lat: 43.256, lng: -79.871 },
  'Kitchener, Ontario': { lat: 43.452, lng: -80.493 },
  'London, Ontario': { lat: 42.984, lng: -81.245 },
  'Markham, Ontario': { lat: 43.856, lng: -79.337 },
  'Mississauga, Ontario': { lat: 43.589, lng: -79.644 },
  'Ottawa, Ontario': { lat: 45.421, lng: -75.697 },
  'Toronto, Ontario': { lat: 43.653, lng: -79.383 },
  'Vaughan, Ontario': { lat: 43.837, lng: -79.508 },
  'Windsor, Ontario': { lat: 42.315, lng: -83.036 },
  'Gatineau, Quebec': { lat: 45.477, lng: -75.701 },
  'Laval, Quebec': { lat: 45.607, lng: -73.712 },
  'Longueuil, Quebec': { lat: 45.531, lng: -73.518 },
  'Montreal, Quebec': { lat: 45.502, lng: -73.567 },
  'Quebec City, Quebec': { lat: 46.813, lng: -71.208 },
  'Sherbrooke, Quebec': { lat: 45.404, lng: -71.893 },
  'Dartmouth, Nova Scotia': { lat: 44.671, lng: -63.577 },
  'Halifax, Nova Scotia': { lat: 44.649, lng: -63.575 },
};

export function cityCoordinates(city: string, province: string): GeoPoint | null {
  return CITY_COORDINATES[`${city}, ${province}`] ?? null;
}
