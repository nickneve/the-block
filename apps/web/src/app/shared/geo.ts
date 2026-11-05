export interface GeoPoint {
  lat: number;
  lng: number;
}

/** ~1 km precision is plenty for "closest dealer" and avoids sending an exact position. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Google Maps for a dealership's city. The dataset has no street addresses (and
 * the dealer names are made up), so this lands on the city, not a storefront.
 * The universal URL opens the Maps app on phones.
 */
export function mapsUrl(city: string, province: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${city}, ${province}, Canada`)}`;
}
