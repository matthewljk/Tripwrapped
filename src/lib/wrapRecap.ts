/**
 * Wrap recap: stats + day-by-day chapters with highlight media.
 * Highlights prioritize: favorited → rated/reviewed → rest; mix of photos and videos.
 */

import { getDateKey } from '@/lib/poiClustering';
import { calculateTripDistance } from '@/lib/tripStats';
import type { MediaWithLocation } from '@/lib/poiClustering';
import type { Schema } from '../../amplify/data/resource';
import { getTotalExpenseInBase } from '@/lib/transactionBalances';

type Transaction = Schema['Transaction']['type'];

export function isVideoPath(path: string | null | undefined): boolean {
  return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(path ?? '');
}

export type WrapRecapStats = {
  tripStartDate: string | null;
  tripEndDate: string | null;
  totalPhotos: number;
  totalVideos: number;
  totalExpense: number;
  baseCurrency: string;
  distanceKm: number;
};

export type WrapRecapMediaItem = {
  id: string;
  storagePath: string;
  timestamp: string | null;
  isFavorite: boolean | null;
  rating: number | null;
  review: string | null;
  locationName: string | null;
  uploadedByUsername: string | null;
  isVideo: boolean;
};

export type WrapRecapDay = {
  dateKey: string;
  dateLabel: string;
  highlights: WrapRecapMediaItem[];
};

export type WrapRecapData = {
  stats: WrapRecapStats;
  days: WrapRecapDay[];
};

type MediaRecord = {
  id: string;
  storagePath: string;
  timestamp?: string | null;
  isFavorite?: boolean | null;
  rating?: number | null;
  review?: string | null;
  locationName?: string | null;
  uploadedByUsername?: string | null;
  lat?: number | null;
  lng?: number | null;
};

function toWrapMedia(m: MediaRecord): WrapRecapMediaItem {
  return {
    id: m.id,
    storagePath: m.storagePath,
    timestamp: m.timestamp ?? null,
    isFavorite: m.isFavorite ?? null,
    rating: m.rating ?? null,
    review: m.review ?? null,
    locationName: m.locationName ?? null,
    uploadedByUsername: m.uploadedByUsername ?? null,
    isVideo: isVideoPath(m.storagePath),
  };
}

/** Sort key: favorited first, then has rating/review, then by timestamp */
function highlightScore(a: WrapRecapMediaItem): number {
  let score = 0;
  if (a.isFavorite) score += 1000;
  if (a.rating != null || (a.review?.trim() ?? '').length > 0) score += 100;
  score += new Date(a.timestamp ?? 0).getTime() / 1e6; // tie-break by time
  return score;
}

/** Pick up to maxPerDay highlights, mixing photos and videos (favorited/rated first). */
function pickHighlights(dayMedia: WrapRecapMediaItem[], maxPerDay: number = 8): WrapRecapMediaItem[] {
  const sorted = [...dayMedia].sort((a, b) => highlightScore(b) - highlightScore(a));
  const photos: WrapRecapMediaItem[] = [];
  const videos: WrapRecapMediaItem[] = [];
  for (const m of sorted) {
    if (m.isVideo) videos.push(m);
    else photos.push(m);
  }
  const result: WrapRecapMediaItem[] = [];
  let pi = 0;
  let vi = 0;
  while (result.length < maxPerDay && (pi < photos.length || vi < videos.length)) {
    if (result.length % 2 === 0 && vi < videos.length) {
      result.push(videos[vi++]);
    } else if (pi < photos.length) {
      result.push(photos[pi++]);
    } else if (vi < videos.length) {
      result.push(videos[vi++]);
    }
  }
  return result;
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function buildWrapRecap(
  trip: { startDate?: string | null; endDate?: string | null; baseCurrency?: string | null } | null,
  media: MediaRecord[],
  transactions: Transaction[],
  baseCurrency: string
): WrapRecapData {
  const items = media.map(toWrapMedia);
  const totalPhotos = items.filter((m) => !m.isVideo).length;
  const totalVideos = items.filter((m) => m.isVideo).length;
  const totalExpense =
    transactions.length > 0 ? getTotalExpenseInBase(transactions, baseCurrency) : 0;
  const withLocation: MediaWithLocation[] = media
    .filter((m): m is MediaRecord & { lat: number; lng: number } => m.lat != null && m.lng != null)
    .map((m) => ({
      id: m.id,
      lat: m.lat!,
      lng: m.lng!,
      timestamp: m.timestamp ?? null,
      isFavorite: m.isFavorite ?? null,
      rating: m.rating ?? null,
      review: m.review ?? null,
      locationName: m.locationName ?? null,
      visited: null,
      storagePath: m.storagePath,
      uploadedBy: undefined,
      uploadedByUsername: m.uploadedByUsername ?? null,
    }));
  const distanceKm = calculateTripDistance(withLocation);

  const byDay = new Map<string, WrapRecapMediaItem[]>();
  for (const m of items) {
    const key = getDateKey(m.timestamp);
    if (!key) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(m);
  }

  const sortedDateKeys = Array.from(byDay.keys()).sort();
  const days: WrapRecapDay[] = sortedDateKeys.map((dateKey) => ({
    dateKey,
    dateLabel: formatDateLabel(dateKey),
    highlights: pickHighlights(byDay.get(dateKey)!, 8),
  }));

  return {
    stats: {
      tripStartDate: trip?.startDate ?? null,
      tripEndDate: trip?.endDate ?? null,
      totalPhotos,
      totalVideos,
      totalExpense,
      baseCurrency: baseCurrency || 'USD',
      distanceKm,
    },
    days,
  };
}

/** Flat timeline for compilation video (chronological); kept for backward compatibility. */
export function getVideoTimeline(data: WrapRecapData): WrapRecapMediaItem[] {
  const all: WrapRecapMediaItem[] = [];
  for (const day of data.days) {
    for (const m of day.highlights) {
      all.push(m);
    }
  }
  return [...all].sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
}

/** Unique location names for a day (from highlights that have locationName). */
export function getLocationNamesForDay(highlights: WrapRecapMediaItem[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of highlights) {
    const name = (m.locationName ?? '').trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      out.push(name);
    }
  }
  return out;
}

/** Filter recap to only include media whose id is NOT in excludedIds. Days with no highlights left are removed. */
export function filterRecapByExcluded(data: WrapRecapData, excludedIds: Set<string>): WrapRecapData {
  const days = data.days
    .map((day) => ({
      ...day,
      highlights: day.highlights.filter((m) => !excludedIds.has(m.id)),
    }))
    .filter((day) => day.highlights.length > 0);
  return { stats: data.stats, days };
}
