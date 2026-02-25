/**
 * Trip statistics: journey distance from photo trail.
 * Uses Haversine between consecutive (time-sorted) photos; skips jitter (<1 min, <100m).
 */

import type { MediaWithLocation } from '@/lib/poiClustering';

const EARTH_RADIUS_M = 6_371_000;
const JITTER_THRESHOLD_MS = 60 * 1000; // 1 minute
const JITTER_THRESHOLD_M = 100;

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

/**
 * Total journey distance in kilometers.
 * - Sorts media by timestamp.
 * - Sums Haversine distance between each consecutive pair.
 * - If two consecutive photos are within 1 minute and <100m apart, that segment is not added (GPS jitter).
 */
export function calculateTripDistance(mediaItems: MediaWithLocation[]): number {
  const withTimeAndLocation = mediaItems.filter(
    (m) =>
      m.timestamp != null &&
      typeof m.lat === 'number' &&
      typeof m.lng === 'number'
  );
  if (withTimeAndLocation.length < 2) return 0;

  const sorted = [...withTimeAndLocation].sort((a, b) => {
    const tA = new Date(a.timestamp!).getTime();
    const tB = new Date(b.timestamp!).getTime();
    return tA - tB;
  });

  let totalMeters = 0;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    const distM = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
    const dtMs = new Date(curr.timestamp!).getTime() - new Date(prev.timestamp!).getTime();
    const withinMinute = Math.abs(dtMs) < JITTER_THRESHOLD_MS;
    const sameLocation = distM < JITTER_THRESHOLD_M;
    if (withinMinute && sameLocation) continue;
    totalMeters += distM;
  }

  return totalMeters / 1000; // km
}
