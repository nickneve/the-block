export interface GeoPoint {
  lat: number;
  lng: number;
}

/** Where the buyer is, plus driving km to each dealership city ("City, Province") when routing answered. */
export interface BuyerOrigin extends GeoPoint {
  roadKm: Readonly<Record<string, number>> | null;
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle ("as the crow flies") distance in km — plenty for "which dealer is closest". */
export function distanceKm(from: GeoPoint, to: GeoPoint): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Parses "lat,lng" (as sent in X-Buyer-Location); anything malformed or out of range is ignored. */
export function parseGeoPoint(value: string | undefined): GeoPoint | null {
  if (!value) return null;
  const parts = value.split(',');
  if (parts.length !== 2) return null;
  const [lat, lng] = parts.map((part) => Number(part.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
