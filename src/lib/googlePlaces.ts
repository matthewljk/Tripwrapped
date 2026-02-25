/**
 * Resolve POI name using Google Places API (New) searchNearby.
 * Uses the app's /api/places/nearby route so the API key stays server-side.
 */

export type MediaForPlaces = {
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

const SAVED_LOCATION_RADIUS_M = 100;

function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

export type ResolveResult = {
  name: string;
  placeId: string | null;
  placeType: string | null;
};

/**
 * Resolve POI name for a cluster (100m).
 * 1. If any media in cluster has locationName → use it (and existing googlePlaceId if any).
 * 2. If user has SavedLocation within 100m → use that name.
 * 3. Call /api/places/nearby (Google Places searchNearby) → name + placeId.
 * Caller is responsible for saving name and placeId to media.
 */
export async function resolveWithGooglePlaces(
  center: { lat: number; lng: number },
  clusterMedia: MediaForPlaces[],
  savedLocations: SavedLocationRecord[] = []
): Promise<ResolveResult> {
  const cached = clusterMedia.find((m) => m.locationName?.trim());
  if (cached?.locationName?.trim()) {
    return { name: cached.locationName.trim(), placeId: null, placeType: null };
  }

  const saved = getSavedLocationName(center, savedLocations);
  if (saved) return { name: saved, placeId: null, placeType: null };

  const res = await fetch('/api/places/nearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      latitude: center.lat,
      longitude: center.lng,
    }),
  });

  if (!res.ok) {
    return { name: 'a location', placeId: null, placeType: null };
  }

  const data = (await res.json()) as {
    name?: string | null;
    placeId?: string | null;
    placeType?: string | null;
  };
  const name = data.name?.trim();
  if (!name) return { name: 'a location', placeId: null, placeType: null };
  return {
    name,
    placeId: data.placeId ?? null,
    placeType: data.placeType ?? null,
  };
}
