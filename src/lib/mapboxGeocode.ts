/**
 * Mapbox reverse geocoding with "cache & guess" strategy:
 * 1. If any media in the cluster already has locationName, use it.
 * 2. If user has a SavedLocation within ~200m, use that (e.g. "IKEA").
 * 3. Otherwise call Mapbox; return a short name (venue/place, not full address).
 */

const GEOCODE_URL =
  'https://api.mapbox.com/geocoding/v5/mapbox.places';
const EARTH_RADIUS_M = 6_371_000;
const SAVED_LOCATION_RADIUS_M = 200;

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

export type MediaForGeocode = {
  id: string;
  locationName?: string | null;
};

export type SavedLocationRecord = {
  id: string;
  userId: string;
  lat: number;
  lng: number;
  name: string;
};

/**
 * Strip postal code from address string (e.g. "..., Singapore 528756" or "..., 123456").
 * Returns address without postal so we don't show "Unknown" and don't need postcode.
 */
function stripPostalCode(placeName: string): string {
  const parts = placeName.split(',').map((p) => p.trim()).filter(Boolean);
  const filtered = parts.filter((part) => {
    const onlyDigits = /^\d{5,8}$/.test(part);
    const endsWithPostal = /\s\d{5,8}$/.test(part);
    return !onlyDigits && !endsWithPostal;
  });
  const result = filtered.join(', ').trim();
  return result || placeName.trim();
}

/**
 * Prefer short name (venue text); if unsure, use full address without postal code.
 * Never return "Unknown" – fall back to address without postal, or "Location".
 */
function toDisplayName(feature: {
  place_name?: string;
  text?: string;
  place_type?: string[];
}): string {
  const short = feature?.text?.trim();
  if (short) return short;
  const full = feature?.place_name?.trim();
  if (!full) return 'Location';
  const withoutPostal = stripPostalCode(full);
  return withoutPostal || full || 'Location';
}

/**
 * If the user has a SavedLocation within SAVED_LOCATION_RADIUS_M of center, return its name.
 */
export function getSavedLocationName(
  center: { lat: number; lng: number },
  savedLocations: SavedLocationRecord[]
): string | null {
  for (const s of savedLocations) {
    const dist = haversineMeters(center.lat, center.lng, s.lat, s.lng);
    if (dist <= SAVED_LOCATION_RADIUS_M) return s.name.trim();
  }
  return null;
}

/**
 * Resolve POI name for a cluster.
 * 1. Cluster cache (media.locationName)
 * 2. User's SavedLocation within 200m (e.g. "IKEA" for 60 Tampines North Drive)
 * 3. Mapbox reverse geocode → short name (text or first part of place_name)
 * Does NOT save to DB here; caller updates media (and optionally creates SavedLocation).
 */
export async function resolveLocationName(
  center: { lat: number; lng: number },
  clusterMedia: MediaForGeocode[],
  accessToken: string,
  savedLocations: SavedLocationRecord[] = []
): Promise<string> {
  const cached = clusterMedia.find((m) => m.locationName?.trim());
  if (cached?.locationName?.trim()) return cached.locationName.trim();

  const saved = getSavedLocationName(center, savedLocations);
  if (saved) return saved;

  const { lng, lat } = center;
  const types = 'place,address,locality,neighborhood';
  const url = `${GEOCODE_URL}/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json?access_token=${encodeURIComponent(accessToken)}&limit=5&types=${encodeURIComponent(types)}`;
  const res = await fetch(url);
  if (!res.ok) return 'Location';
  const data = (await res.json()) as {
    features?: Array<{
      place_name?: string;
      text?: string;
      place_type?: string[];
    }>;
  };
  const features = data.features ?? [];
  const typeOrder = ['place', 'address', 'locality', 'neighborhood'];
  const preferred = typeOrder.reduce(
    (acc, t) => acc ?? features.find((f) => f.place_type?.includes(t)),
    null as typeof features[0] | null
  );
  const feature = preferred ?? features[0];
  return feature ? toDisplayName(feature) : 'Location';
}
