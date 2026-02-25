/**
 * POI clustering and Daily Journal helpers.
 * Groups media by date and by geographic proximity (~200m) for Points of Interest.
 */

const EARTH_RADIUS_M = 6_371_000;

export type MediaWithLocation = {
  id: string;
  lat: number;
  lng: number;
  timestamp: string | null;
  isFavorite?: boolean | null;
  rating?: number | null;
  review?: string | null;
  locationName?: string | null;
  visited?: boolean | null;
  storagePath?: string;
  uploadedBy?: string;
  uploadedByUsername?: string | null;
};

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

/** ISO timestamp -> "YYYY-MM-DD" (date only) for grouping by day */
export function getDateKey(timestamp: string | null): string | null {
  if (!timestamp || typeof timestamp !== 'string') return null;
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Cluster media by proximity; each cluster becomes a POI. Merges clusters if any two points are within radius. */
export function clusterByProximity(
  items: MediaWithLocation[],
  radiusMeters: number = 200
): MediaWithLocation[][] {
  if (items.length === 0) return [];
  const assigned = new Set<string>();
  const clusters: MediaWithLocation[][] = [];

  for (const seed of items) {
    if (assigned.has(seed.id)) continue;
    const cluster: MediaWithLocation[] = [seed];
    assigned.add(seed.id);
    for (const other of items) {
      if (assigned.has(other.id)) continue;
      const dist = haversineMeters(seed.lat, seed.lng, other.lat, other.lng);
      if (dist <= radiusMeters) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }
    clusters.push(cluster);
  }

  // Merge clusters: if any point in A is within radius of any point in B, merge
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const a = clusters[i];
        const b = clusters[j];
        const shouldMerge = a.some((pa) =>
          b.some(
            (pb) =>
              haversineMeters(pa.lat, pa.lng, pb.lat, pb.lng) <= radiusMeters
          )
        );
        if (shouldMerge) {
          clusters[i] = [...a, ...b];
          clusters.splice(j, 1);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  return clusters;
}

/** Center of a cluster (average lat/lng) */
export function clusterCenter(
  cluster: MediaWithLocation[]
): { lat: number; lng: number } {
  if (cluster.length === 0) return { lat: 0, lng: 0 };
  const sumLat = cluster.reduce((s, m) => s + m.lat, 0);
  const sumLng = cluster.reduce((s, m) => s + m.lng, 0);
  return {
    lat: sumLat / cluster.length,
    lng: sumLng / cluster.length,
  };
}

/** Highlight score: isFavorite (high weight) + rating + comment length. Highest = Highlight of the Day. */
export function highlightScore(item: MediaWithLocation): number {
  let score = 0;
  if (item.isFavorite) score += 100;
  const rating = item.rating ?? 0;
  if (rating >= 1 && rating <= 5) score += rating * 10;
  const reviewLen = (item.review ?? '').trim().length;
  score += Math.min(50, Math.floor(reviewLen / 2));
  return score;
}

/** Pick the highlight media for a list (e.g. one day's media). */
export function pickHighlight(media: MediaWithLocation[]): MediaWithLocation | null {
  if (media.length === 0) return null;
  let best = media[0];
  let bestScore = highlightScore(best);
  for (let i = 1; i < media.length; i++) {
    const s = highlightScore(media[i]);
    if (s > bestScore) {
      bestScore = s;
      best = media[i];
    }
  }
  if (bestScore === 0) return media[Math.floor(Math.random() * media.length)];
  return best;
}

/** Group media by date key; returns map of dateKey -> media[] */
export function groupByDate(
  items: MediaWithLocation[]
): Map<string, MediaWithLocation[]> {
  const map = new Map<string, MediaWithLocation[]>();
  for (const m of items) {
    const key = getDateKey(m.timestamp) ?? 'unknown';
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  return map;
}

export type POICluster = {
  center: { lat: number; lng: number };
  media: MediaWithLocation[];
  locationName: string | null;
  placeType?: string | null;
};

/** For a single day's media (with lat/lng), return POI clusters ranked by media count (top first). */
export function getPOIsForDay(
  dayMedia: MediaWithLocation[],
  radiusMeters: number = 200
): POICluster[] {
  const withLocation = dayMedia.filter(
    (m) => typeof m.lat === 'number' && typeof m.lng === 'number'
  );
  if (withLocation.length === 0) return [];
  const clusters = clusterByProximity(withLocation, radiusMeters);
  const pois: POICluster[] = clusters.map((media) => {
    const center = clusterCenter(media);
    const locationName =
      media.find((m) => m.locationName?.trim())?.locationName?.trim() ?? null;
    return { center, media, locationName };
  });
  pois.sort((a, b) => b.media.length - a.media.length);
  return pois;
}

/** Day index from trip start (1-based). startDate is "YYYY-MM-DD" or null. */
export function getDayIndex(
  dateKey: string,
  tripStartDate: string | null
): number | null {
  if (!tripStartDate) return null;
  const start = new Date(tripStartDate);
  const day = new Date(dateKey + 'T12:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(day.getTime())) return null;
  const diffMs = day.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (diffDays < 0) return null;
  return diffDays + 1;
}
