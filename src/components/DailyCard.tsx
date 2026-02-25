'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getUrl } from 'aws-amplify/storage';
import type { POICluster } from '@/lib/poiClustering';
import type { MediaWithLocation } from '@/lib/poiClustering';
import { getCategoryLabel } from '@/lib/transactionCategories';

const URL_EXPIRES_IN = 3600;

const PLACE_TYPE_ICONS: Record<string, string> = {
  Restaurant: '🍽️',
  Cafe: '☕',
  Bar: '🍸',
  Takeaway: '🥡',
  Delivery: '🛵',
  'Food & drink': '🍴',
  Hotel: '🏨',
  'Tourist attraction': '📍',
  Museum: '🎭',
  'Art gallery': '🖼️',
  Park: '🌳',
  'Natural feature': '🏔️',
  'Shopping mall': '🛒',
  'Department store': '🏬',
  Supermarket: '🛍️',
  Store: '🏪',
  'Clothing store': '👕',
  'Furniture store': '🪑',
  'Home goods': '🛋️',
  Gym: '💪',
  Spa: '💆',
  Stadium: '🏟️',
  'Amusement park': '🎢',
  Zoo: '🦁',
  Aquarium: '🐠',
  Cinema: '🎬',
  'Night club': '🎉',
  Airport: '✈️',
  'Transit station': '🚉',
  'Gas station': '⛽',
  Parking: '🅿️',
  'Place of worship': '⛪',
  School: '🏫',
  University: '🎓',
  Hospital: '🏥',
  Pharmacy: '💊',
  Establishment: '🏢',
  'Point of interest': '📍',
  'Theme park': '🎢',
  'Water park': '🌊',
  'Historic site': '🏛️',
  'Cultural site': '🏛️',
  Castle: '🏰',
  Monument: '🗽',
  Theater: '🎭',
  'Concert hall': '🎵',
  Bakery: '🥐',
  Market: '🛒',
  'National park': '🏞️',
  Garden: '🌷',
  'Botanical garden': '🌿',
  'Hiking area': '🥾',
  'Scenic spot': '🏔️',
  Beach: '🏖️',
  Lake: '🛶',
  River: '🌊',
  Mountain: '⛰️',
  Resort: '🏨',
  Hostel: '🛏️',
  Campground: '⛺',
  Subway: '🚇',
  'Train station': '🚂',
  'Bus station': '🚌',
  Neighborhood: '📍',
  Locality: '📍',
};

function getPlaceIcon(placeType: string | null | undefined): string {
  if (!placeType?.trim()) return '📍';
  return PLACE_TYPE_ICONS[placeType.trim()] ?? '📍';
}

/** Earliest timestamp in POI media (ms), or Infinity if none. */
function getPoiEarliestTime(poi: POICluster): number {
  const withTime = poi.media
    .map((m) => (m.timestamp ? new Date(m.timestamp).getTime() : NaN))
    .filter((t) => !Number.isNaN(t));
  return withTime.length === 0 ? Infinity : Math.min(...withTime);
}

/** Earliest timestamp in POI media, formatted as time (e.g. "9:42 AM"). */
function getPoiTimeLabel(poi: POICluster): string {
  const t = getPoiEarliestTime(poi);
  if (t === Infinity) return '';
  return new Date(t).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function isImage(path: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic)$/i.test(path);
}

function isHeic(path: string): boolean {
  return /\.(heic|heif)$/i.test(path ?? '');
}

function UserAvatar({
  username,
  size = 'sm',
  stacked,
}: {
  username: string | null | undefined;
  size?: 'sm' | 'md';
  stacked?: boolean;
}) {
  const displayName = username?.trim() || '?';
  const initial = (displayName[0] ?? '?').toUpperCase();
  const sizeClass = size === 'sm' ? 'h-6 w-6 text-xs' : 'h-8 w-8 text-sm';
  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center rounded-full bg-slate-600 font-medium text-white ${sizeClass} ${stacked ? 'ring-2 ring-white' : ''}`}
      title={displayName}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function isVideo(path: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(path);
}

export type DailyCardProps = {
  dayIndex: number | null;
  dateLabel: string;
  highlightMedia: MediaWithLocation | null;
  /** Other media from the same day; used as fallback if highlight fails to load */
  alternateMedia?: MediaWithLocation[];
  pois: POICluster[];
  totalCount: number;
  averageRating: number | null;
  /** Total expense for this day in base currency */
  totalExpense?: number;
  /** Expense by category for this day (categoryId -> amount in base currency) */
  expenseByCategory?: Record<string, number>;
  /** Per-category amounts in original currencies (categoryId -> currency -> amount) for multi-currency display */
  expenseByCategoryByCurrency?: Record<string, Record<string, number>>;
  /** Base currency code for display (e.g. USD) */
  baseCurrency?: string;
  /** Number of trip participants (for average per person) */
  participantCount?: number;
  onSaveReview: (
    mediaIds: string[],
    rating: number | null,
    review: string | null
  ) => Promise<void>;
  onSaveLocationName?: (
    center: { lat: number; lng: number },
    name: string,
    mediaIds: string[]
  ) => Promise<void>;
  onClearLocation?: (mediaIds: string[], center: { lat: number; lng: number }) => Promise<void>;
};

export default function DailyCard({
  dayIndex,
  dateLabel,
  highlightMedia,
  alternateMedia = [],
  pois,
  totalCount,
  averageRating,
  totalExpense = 0,
  expenseByCategory = {},
  expenseByCategoryByCurrency = {},
  baseCurrency = 'USD',
  participantCount = 1,
  onSaveReview,
  onSaveLocationName,
  onClearLocation,
}: DailyCardProps) {
  const [expandedPoiKey, setExpandedPoiKey] = useState<string | null>(null);
  const [expenseSummaryExpanded, setExpenseSummaryExpanded] = useState(false);
  const [highlightUrl, setHighlightUrl] = useState<string | null>(null);
  const [highlightLoaded, setHighlightLoaded] = useState(false);
  const [highlightFailed, setHighlightFailed] = useState(false);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [inView, setInView] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Candidates: primary highlight first, then alternates; skip HEIC (don't load, poor browser support)
  const highlightCandidates = useMemo(() => {
    const list: MediaWithLocation[] = [];
    const add = (m: MediaWithLocation) => {
      if (m?.storagePath && !isHeic(m.storagePath)) list.push(m);
    };
    if (highlightMedia) add(highlightMedia);
    const seen = new Set(list.map((m) => m.id));
    for (const m of alternateMedia) {
      if (m?.storagePath && !seen.has(m.id)) {
        seen.add(m.id);
        add(m);
      }
    }
    return list;
  }, [highlightMedia, alternateMedia]);

  const currentCandidate = highlightCandidates[candidateIndex] ?? null;

  useEffect(() => {
    setCandidateIndex(0);
    setHighlightUrl(null);
    setHighlightLoaded(false);
    setHighlightFailed(false);
  }, [highlightMedia?.id]);

  // Observe when card is in view so we only load then
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setInView(!!entries[0]?.isIntersecting);
      },
      { rootMargin: '200px', threshold: 0.01 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Load highlight when in view; on failure try next candidate (another photo)
  useEffect(() => {
    if (!inView || !currentCandidate?.storagePath) {
      if (!highlightCandidates.length) setHighlightFailed(true);
      return;
    }
    let cancelled = false;
    const path = currentCandidate.storagePath;

    const load = (retry = false) => {
      getUrl({
        path,
        options: { expiresIn: URL_EXPIRES_IN },
      })
        .then(({ url }) => {
          if (!cancelled) {
            setHighlightLoaded(false);
            setHighlightUrl(url.toString());
            setHighlightFailed(false);
          }
        })
        .catch(() => {
          if (cancelled) return;
          if (retry) {
            if (candidateIndex < highlightCandidates.length - 1) {
              setCandidateIndex((i) => i + 1);
            } else {
              setHighlightFailed(true);
              setHighlightUrl(null);
            }
          } else {
            setTimeout(() => load(true), 3000);
          }
        });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [inView, currentCandidate?.storagePath, currentCandidate?.id, candidateIndex, highlightCandidates.length]);

  const header =
    dayIndex != null ? `Day ${dayIndex}` : dateLabel;
  // Photo Trail: chronological order (earliest first) so the trail matches the day
  const trailPois = [...pois]
    .sort((a, b) => getPoiEarliestTime(a) - getPoiEarliestTime(b))
    .slice(0, 5);

  const contributorNames = useMemo(() => {
    const set = new Set<string>();
    for (const poi of pois) {
      for (const m of poi.media) {
        if (m.uploadedByUsername?.trim()) set.add(m.uploadedByUsername.trim());
      }
    }
    return Array.from(set);
  }, [pois]);

  return (
    <div ref={cardRef} className="card overflow-hidden">
      {/* Hero: Highlight of the day (or fallback photo if primary fails to load). Only show when fully loaded. */}
      <div className="relative aspect-[4/3] w-full bg-slate-100 sm:aspect-[21/9]">
          {highlightUrl && currentCandidate?.storagePath ? (
            isImage(currentCandidate.storagePath) ? (
              <>
                {!highlightLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" aria-hidden />
                  </div>
                )}
                <img
                  src={highlightUrl}
                  alt=""
                  className={`h-full w-full object-cover transition-opacity duration-200 ${highlightLoaded ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setHighlightLoaded(true)}
                />
              </>
            ) : isVideo(currentCandidate.storagePath) ? (
              <>
                {!highlightLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" aria-hidden />
                  </div>
                )}
                <video
                  src={highlightUrl}
                  className={`h-full w-full object-cover transition-opacity duration-200 ${highlightLoaded ? 'opacity-100' : 'opacity-0'}`}
                  muted
                  playsInline
                  preload="metadata"
                  onLoadedData={() => setHighlightLoaded(true)}
                />
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl text-slate-400">
                📷
              </div>
            )
          ) : highlightFailed ? (
            <div className="flex h-full w-full items-center justify-center text-4xl text-slate-300">
              📷
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" aria-hidden />
            </div>
          )}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 sm:p-4">
            <p className="text-base font-bold text-white drop-shadow sm:text-lg">{header}</p>
            <p className="text-xs text-white/90 sm:text-sm">{dateLabel}</p>
          </div>
        </div>

      {/* Photo Trail — each row: Time - Icon [location]; tap to expand that location only */}
      <div className="border-t border-slate-100 p-3 sm:p-4">
        <p className="text-sm font-semibold text-slate-700">Photo Trail</p>
        {trailPois.length > 0 ? (
          <ul className="mt-3 space-y-0 border-l-2 border-slate-200 pl-6 sm:pl-8" role="list">
            {trailPois.map((poi, i) => {
              const timeLabel = getPoiTimeLabel(poi);
              const poiKey = poi.media[0]?.id ?? `poi-${poi.center.lat}-${poi.center.lng}-${i}`;
              const isExpanded = expandedPoiKey === poiKey;
              return (
                <li key={poiKey} className="relative first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => setExpandedPoiKey((k) => (k === poiKey ? null : poiKey))}
                    className="relative flex w-full items-center gap-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
                  >
                    <span
                      className="absolute -left-6 top-1/2 -ml-3 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border-2 border-slate-200 bg-white text-xs shadow-sm sm:-left-8 sm:h-6 sm:w-6 sm:text-sm"
                      aria-hidden
                    >
                      {getPlaceIcon(poi.placeType)}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0 text-sm text-slate-700">
                      {timeLabel && (
                        <span className="text-slate-500">{timeLabel} –</span>
                      )}
                      <span className="font-medium">{poi.locationName || 'a location'}</span>
                    </div>
                    <span
                      className={`flex-shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      aria-hidden
                    >
                      ▼
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-slate-200 bg-slate-50/50 py-4 pl-0 pr-0">
                      <POISection
                        poi={poi}
                        onSaveReview={onSaveReview}
                        onSaveLocationName={onSaveLocationName}
                        onClearLocation={onClearLocation}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No locations</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Tap a location to add a rating or correct it
        </p>

        {/* Summary: average stars, locations visited, contributors (same line) */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-200 pt-3 sm:mt-4 sm:gap-x-4 sm:pt-4">
          {averageRating != null && averageRating >= 1 && averageRating <= 5 && (
            <span className="text-sm font-medium text-amber-600">★ {averageRating.toFixed(1)} average</span>
          )}
          {trailPois.length > 0 && (
            <span className="text-sm text-slate-600">
              {trailPois.length} location{trailPois.length !== 1 ? 's' : ''} visited
            </span>
          )}
          {contributorNames.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-500">Contributors</span>
              <div className="flex -space-x-1.5">
                {contributorNames.slice(0, 6).map((name) => (
                  <UserAvatar key={name} username={name} size="sm" stacked />
                ))}
                {contributorNames.length > 6 && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-400 text-xs font-medium text-white">
                    +{contributorNames.length - 6}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Expenses: below on its own line(s) */}
        {(() => {
          const totalByCurrency: Record<string, number> = {};
          if (Object.keys(expenseByCategoryByCurrency).length > 0) {
            for (const catAmounts of Object.values(expenseByCategoryByCurrency)) {
              for (const [curr, amt] of Object.entries(catAmounts)) {
                totalByCurrency[curr] = (totalByCurrency[curr] ?? 0) + amt;
              }
            }
          }
          const hasTotalByCurrency = Object.keys(totalByCurrency).length > 0;
          const singleCurrency = hasTotalByCurrency && Object.keys(totalByCurrency).length === 1;
          const showLegacyTotal = totalExpense > 0 && !hasTotalByCurrency;
          if (!hasTotalByCurrency && !showLegacyTotal) return null;
          return (
            <div className="mt-3 text-xs font-medium text-slate-700 sm:text-sm">
              <span className="font-medium">Total expense: </span>
              {hasTotalByCurrency
                ? Object.entries(totalByCurrency)
                    .map(([curr, amt]) =>
                      new Intl.NumberFormat(undefined, { style: 'currency', currency: curr || baseCurrency, minimumFractionDigits: 2 }).format(amt)
                    )
                    .join(', ')
                : new Intl.NumberFormat(undefined, { style: 'currency', currency: baseCurrency, minimumFractionDigits: 2 }).format(totalExpense)}
              {participantCount > 1 &&
                (hasTotalByCurrency
                  ? (singleCurrency
                      ? ` · ${new Intl.NumberFormat(undefined, { style: 'currency', currency: Object.keys(totalByCurrency)[0], minimumFractionDigits: 2 }).format(Object.values(totalByCurrency)[0]! / participantCount)} per person`
                      : ` · ${Object.entries(totalByCurrency)
                          .map(([curr, amt]) =>
                            new Intl.NumberFormat(undefined, { style: 'currency', currency: curr, minimumFractionDigits: 2 }).format(amt / participantCount)
                          )
                          .join(', ')} per person`)
                  : ` · ${new Intl.NumberFormat(undefined, { style: 'currency', currency: baseCurrency, minimumFractionDigits: 2 }).format(totalExpense / participantCount)} per person`)}
            </div>
          );
        })()}

        {/* Expanded: what the money was spent on (by category, multi-currency) */}
        {(Object.keys(expenseByCategory).length > 0 || Object.keys(expenseByCategoryByCurrency).length > 0) && (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setExpenseSummaryExpanded((e) => !e)}
              className="flex w-full items-center justify-between text-left text-sm font-medium text-slate-700 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span>What it was spent on</span>
              <span className={`text-slate-400 transition-transform ${expenseSummaryExpanded ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {expenseSummaryExpanded && (
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {(
                  Object.keys(expenseByCategoryByCurrency).length > 0
                    ? Object.entries(expenseByCategoryByCurrency)
                    : Object.entries(expenseByCategory).map(([catId, amt]) => [catId, { [baseCurrency]: amt }] as [string, Record<string, number>])
                )
                  .sort(([, amountsA], [, amountsB]) => {
                    const sumA = Object.values(amountsA).reduce((s, v) => s + v, 0);
                    const sumB = Object.values(amountsB).reduce((s, v) => s + v, 0);
                    return sumB - sumA;
                  })
                  .map(([catId, amounts]) => (
                    <li key={String(catId)} className="flex justify-between gap-2 text-left">
                      <span className="min-w-0 flex-1">{getCategoryLabel(catId)}</span>
                      <span className="flex-shrink-0 font-medium text-slate-800 text-right">
                        {Object.entries(amounts)
                          .map(([curr, amt]) =>
                            new Intl.NumberFormat(undefined, { style: 'currency', currency: curr || baseCurrency, minimumFractionDigits: 2 }).format(amt)
                          )
                          .join(', ')}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function POISection({
  poi,
  onSaveReview,
  onSaveLocationName,
  onClearLocation,
}: {
  poi: POICluster;
  onSaveReview: (
    mediaIds: string[],
    rating: number | null,
    review: string | null
  ) => Promise<void>;
  onSaveLocationName?: (
    center: { lat: number; lng: number },
    name: string,
    mediaIds: string[]
  ) => Promise<void>;
  onClearLocation?: (mediaIds: string[], center: { lat: number; lng: number }) => Promise<void>;
}) {
  const name = poi.locationName || 'a location';
  const mediaIds = poi.media.map((m) => m.id);
  const first = poi.media[0];
  const poiId = first?.id ?? `lat-${poi.center.lat}-lng-${poi.center.lng}`;
  const [rating, setRating] = useState<number | null>(
    first?.rating ?? null
  );
  const [review, setReview] = useState(first?.review ?? '');
  const [customName, setCustomName] = useState(poi.locationName?.trim() || '');
  const [saving, setSaving] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [locationStep, setLocationStep] = useState<'ask' | 'rename'>('ask');
  const [locationBlockDismissed, setLocationBlockDismissed] = useState(false);

  // Per-location: if user has already saved rating or review for this POI, don't prompt anymore
  const hasExistingReview = poi.media.some(
    (m) =>
      (m.rating != null && m.rating >= 1 && m.rating <= 5) ||
      (String(m.review ?? '').trim().length > 0)
  );
  const showPrompts = !hasExistingReview;

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onSaveReview(mediaIds, rating, review.trim() || null);
    } finally {
      setSaving(false);
    }
  }, [mediaIds, rating, review, onSaveReview]);

  const handleSaveName = useCallback(async () => {
    if (!onSaveLocationName || !customName.trim()) return;
    setSavingName(true);
    try {
      await onSaveLocationName(poi.center, customName.trim(), mediaIds);
      setLocationBlockDismissed(true);
    } finally {
      setSavingName(false);
    }
  }, [poi.center, customName, mediaIds, onSaveLocationName]);

  return (
    <div className="mb-6 last:mb-0">
      <h3 className="text-sm font-semibold text-slate-800">{name}</h3>
      <p className="text-xs text-slate-500">
        {poi.media.length} photo{poi.media.length !== 1 ? 's' : ''} / video{poi.media.length !== 1 ? 's' : ''}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {poi.media.slice(0, 6).map((m) => (
          <POIThumb key={m.id} storagePath={m.storagePath} />
        ))}
        {poi.media.length > 6 && (
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-200 text-xs font-medium text-slate-600">
            +{poi.media.length - 6}
          </span>
        )}
      </div>

      {showPrompts && onSaveLocationName && !locationBlockDismissed && (
        <div className="mt-3">
          {locationStep === 'ask' && (
            <>
              <p className="text-xs font-medium text-slate-600">Is this location accurate?</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setLocationBlockDismissed(true)}
                  className="btn-primary text-sm"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setLocationStep('rename')}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                >
                  No
                </button>
              </div>
            </>
          )}
          {locationStep === 'rename' && (
            <>
              <label htmlFor={`name-${poiId}`} className="block text-xs font-medium text-slate-600">
                Where was this photo taken?
              </label>
              <p className="mt-0.5 text-xs text-slate-500">
                We&apos;ll remember this for next time at nearby spots.
              </p>
              <div className="mt-1.5 flex gap-2">
                <input
                  id={`name-${poiId}`}
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. IKEA Tampines, Marina Bay Sands"
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={savingName || !customName.trim()}
                  className="btn-primary text-sm"
                >
                  {savingName ? 'Saving…' : 'Save'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {showPrompts ? (
        <div className="mt-3 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600">
              Star rating
            </label>
            <div className="mt-1 flex gap-1" role="group" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating((r) => (r === star ? null : star))}
                  className={`rounded p-1 text-lg leading-none transition ${rating != null && star <= rating ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}`}
                  aria-label={`${star} star${star > 1 ? 's' : ''}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <div>
          <label htmlFor={`review-${poiId}`} className="block text-xs font-medium text-slate-600">
            Your review
          </label>
          <textarea
            id={`review-${poiId}`}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="Share a highlight or memory from this spot…"
              rows={2}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            />
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm"
          >
            {saving ? 'Saving…' : 'Save rating & review'}
          </button>
        </div>
      ) : hasExistingReview && (
        <div className="mt-3 flex items-start gap-2">
          <UserAvatar username={first?.uploadedByUsername} size="sm" />
          <div className="min-w-0 flex-1 text-xs text-slate-600">
            {first?.rating != null && first.rating >= 1 && first.rating <= 5 && (
              <span className="font-medium text-amber-600">★ {first.rating}</span>
            )}
            {first?.rating != null && first.rating >= 1 && first.rating <= 5 && first?.review?.trim() && (
              <span className="ml-1">·</span>
            )}
            {first?.review?.trim() && (
              <span className="ml-1">
                {first.review.trim().length > 80 ? `${first.review.trim().slice(0, 80)}…` : first.review.trim()}
              </span>
            )}
            {!first?.review?.trim() && (first?.rating == null || first.rating < 1 || first.rating > 5) && (
              <span className="text-slate-500">Reviewed this spot</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function POIThumb({ storagePath }: { storagePath?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!storagePath) return;
    let cancelled = false;
    getUrl({ path: storagePath, options: { expiresIn: URL_EXPIRES_IN } }).then(
      ({ url: u }) => {
        if (!cancelled) setUrl(u.toString());
      }
    );
    return () => {
      cancelled = true;
    };
  }, [storagePath]);
  return (
    <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-200">
      {url ? (
        isImage(storagePath ?? '') ? (
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg">
            🎬
          </div>
        )
      ) : (
        <div className="h-full w-full animate-pulse bg-slate-300" />
      )}
    </div>
  );
}
