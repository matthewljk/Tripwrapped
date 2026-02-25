'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getCurrentUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import LoadingSpinner from '@/components/LoadingSpinner';
import TripSelector from '@/components/TripSelector';
import DailyCard from '@/components/DailyCard';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import {
  type MediaWithLocation,
  type POICluster,
  getDateKey,
  getDayIndex,
  getPOIsForDay,
  groupByDate,
  pickHighlight,
} from '@/lib/poiClustering';
import { resolveWithGooglePlaces } from '@/lib/googlePlaces';
import { getExpensesByDay } from '@/lib/transactionBalances';
import { useTripParticipants } from '@/hooks/useTripParticipants';

const dataClient = generateClient<Schema>();

function toMediaWithLocation(
  m: Schema['Media']['type']
): MediaWithLocation | null {
  if (m.lat == null || m.lng == null) return null;
  return {
    id: m.id,
    storagePath: m.storagePath,
    lat: m.lat,
    lng: m.lng,
    timestamp: m.timestamp ?? null,
    isFavorite: m.isFavorite ?? null,
    rating: m.rating ?? null,
    review: m.review ?? null,
    locationName: m.locationName ?? null,
    visited: m.visited ?? null,
    uploadedBy: m.uploadedBy,
    uploadedByUsername: m.uploadedByUsername ?? null,
  };
}

function formatDateLabel(dateKey: string): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function JournalPage() {
  const { activeTripId, activeTrip, hasTrip, loading } = useActiveTrip();
  const { participants } = useTripParticipants(activeTripId);
  const [media, setMedia] = useState<MediaWithLocation[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [transactions, setTransactions] = useState<Schema['Transaction']['type'][]>([]);
  const [savedLocations, setSavedLocations] = useState<
    Array<{ id: string; userId: string; lat: number; lng: number; name: string }>
  >([]);
  const [poiNamesResolved, setPoiNamesResolved] = useState<
    Map<string, POICluster[]>
  >(new Map());

  useEffect(() => {
    if (!activeTripId) {
      setMedia([]);
      setLoadingMedia(false);
      return;
    }
    setLoadingMedia(true);
    dataClient.models.Media.list({
      filter: { tripId: { eq: activeTripId } },
    }).then(({ data: list }) => {
      const withLoc = (list ?? [])
        .map(toMediaWithLocation)
        .filter((m): m is MediaWithLocation => m != null);
      setMedia(withLoc);
      setLoadingMedia(false);
    }).catch((err) => {
      console.error('Journal: failed to load media', err);
      setMedia([]);
      setLoadingMedia(false);
    });
  }, [activeTripId]);

  useEffect(() => {
    if (!activeTripId) {
      setTransactions([]);
      return;
    }
    dataClient.models.Transaction.list({
      filter: { tripId: { eq: activeTripId } },
    }).then(({ data }) => setTransactions(data ?? [])).catch(() => setTransactions([]));
  }, [activeTripId]);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser()
      .then(({ userId }) =>
        dataClient.models.SavedLocation.list({
          filter: { userId: { eq: userId } },
        })
      )
      .then(({ data: list }) => {
        if (!cancelled && list)
          setSavedLocations(
            list.map((s) => ({
              id: s.id,
              userId: s.userId,
              lat: s.lat,
              lng: s.lng,
              name: s.name,
            }))
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const byDate = groupByDate(media);
  const dateKeys = Array.from(byDate.keys()).filter((k) => k !== 'unknown');
  dateKeys.sort((a, b) => b.localeCompare(a));

  const baseCurrency = activeTrip?.baseCurrency ?? 'USD';
  const expensesByDay = getExpensesByDay(transactions, baseCurrency);

  const tripStartDate = activeTrip?.startDate ?? null;

  useEffect(() => {
    if (dateKeys.length === 0) {
      setPoiNamesResolved(new Map());
      return;
    }
    let cancelled = false;
    const run = async () => {
      const resolved = new Map<string, POICluster[]>();
      for (const dateKey of dateKeys) {
        const dayMedia = byDate.get(dateKey) ?? [];
        const pois = getPOIsForDay(dayMedia, 100);
        const withNames: POICluster[] = [];
        for (const poi of pois) {
          const { name, placeId, placeType } = await resolveWithGooglePlaces(
            poi.center,
            poi.media,
            savedLocations
          );
          if (cancelled) return;
          withNames.push({ ...poi, locationName: name, placeType: placeType ?? undefined });
          const hadCached = poi.media.some((m) => m.locationName?.trim());
          if (!hadCached && name !== 'a location') {
            for (const m of poi.media) {
              try {
                await dataClient.models.Media.update({
                  id: m.id,
                  locationName: name,
                  ...(placeId ? { googlePlaceId: placeId } : {}),
                });
              } catch {
                // ignore
              }
            }
          }
        }
        resolved.set(dateKey, withNames);
      }
      if (!cancelled) setPoiNamesResolved(resolved);
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [dateKeys.join(','), media.length, savedLocations]);

  const handleSaveLocationName = useCallback(
    async (
      center: { lat: number; lng: number },
      name: string,
      mediaIds: string[]
    ) => {
      const { userId } = await getCurrentUser();
      const nameTrim = name.trim();
      if (!nameTrim) return;
      for (const id of mediaIds) {
        try {
          await dataClient.models.Media.update({
            id,
            locationName: nameTrim,
            googlePlaceId: null,
          });
        } catch {
          // continue
        }
      }
      setMedia((prev) =>
        prev.map((m) =>
          mediaIds.includes(m.id) ? { ...m, locationName: nameTrim } : m
        )
      );
      const R = 6_371_000;
      const rad = (d: number) => (d * Math.PI) / 180;
      const haversine = (
        lat1: number,
        lng1: number,
        lat2: number,
        lng2: number
      ) => {
        const dLat = rad(lat2 - lat1);
        const dLng = rad(lng2 - lng1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
      const existing = savedLocations.find(
        (s) => haversine(center.lat, center.lng, s.lat, s.lng) <= 200
      );
      if (existing) {
        try {
          await dataClient.models.SavedLocation.update({
            id: existing.id,
            name: nameTrim,
          });
          setSavedLocations((prev) =>
            prev.map((s) =>
              s.id === existing.id ? { ...s, name: nameTrim } : s
            )
          );
        } catch {
          // ignore
        }
      } else {
        try {
          const { data: created } = await dataClient.models.SavedLocation.create(
            { userId, lat: center.lat, lng: center.lng, name: nameTrim }
          );
          if (created)
            setSavedLocations((prev) => [...prev, { ...created, name: nameTrim }]);
        } catch {
          // ignore
        }
      }
      setPoiNamesResolved((prev) => {
        const next = new Map(prev);
        next.forEach((pois, dateKey) => {
          next.set(
            dateKey,
            pois.map((poi) =>
              poi.center.lat === center.lat && poi.center.lng === center.lng
                ? { ...poi, locationName: nameTrim }
                : poi
            )
          );
        });
        return next;
      });
    },
    [savedLocations]
  );

  const handleClearLocation = useCallback(
    async (mediaIds: string[], center: { lat: number; lng: number }) => {
      for (const id of mediaIds) {
        try {
          await dataClient.models.Media.update({
            id,
            locationName: null,
            googlePlaceId: null,
          });
        } catch {
          // continue
        }
      }
      setMedia((prev) =>
        prev.map((m) =>
          mediaIds.includes(m.id) ? { ...m, locationName: null } : m
        )
      );
      setPoiNamesResolved((prev) => {
        const next = new Map(prev);
        next.forEach((pois, dateKey) => {
          next.set(
            dateKey,
            pois.map((poi) =>
              poi.center.lat === center.lat && poi.center.lng === center.lng
                ? { ...poi, locationName: null }
                : poi
            )
          );
        });
        return next;
      });
    },
    []
  );

  const handleSaveReview = useCallback(
    async (
      mediaIds: string[],
      rating: number | null,
      review: string | null
    ) => {
      for (const id of mediaIds) {
        try {
          await dataClient.models.Media.update({
            id,
            rating,
            review,
          });
        } catch {
          // continue
        }
      }
      setMedia((prev) =>
        prev.map((m) =>
          mediaIds.includes(m.id)
            ? { ...m, rating, review }
            : m
        )
      );
    },
    []
  );

  if (loading) return <LoadingSpinner />;

  if (!hasTrip) {
    return (
      <div className="mx-auto max-w-2xl px-5 pb-28 pt-20 sm:pb-24 sm:pt-24 sm:px-6 safe-area-padding">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Daily Journal
        </h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Create or join a trip to see your days and locations.
        </p>
        <Link href="/trips" className="btn-primary mt-6 inline-block w-full sm:w-auto">
          Create or join a trip
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-28 pt-20 sm:pb-24 sm:pt-24 sm:px-6 safe-area-padding">
      <div className="flex flex-col gap-4 border-b border-slate-100 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:py-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Daily Journal
          </h1>
          <p className="mt-1 text-sm text-slate-600 sm:text-base">
            Your trip by day and location
          </p>
        </div>
        <TripSelector />
      </div>

      {loadingMedia ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : dateKeys.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
          <p className="text-slate-600">
            No photos or videos with date and location yet. Add some from the
            Upload page.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-block">
            Upload
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-6 sm:mt-8 sm:space-y-8">
          {dateKeys.map((dateKey) => {
            const dayMedia = byDate.get(dateKey) ?? [];
            const poisStructure = getPOIsForDay(dayMedia, 100);
            const resolvedNames = poiNamesResolved.get(dateKey) ?? [];
            const pois: POICluster[] = poisStructure.map((poi, i) => ({
              ...poi,
              locationName:
                resolvedNames[i]?.locationName ?? poi.locationName,
              placeType:
                resolvedNames[i]?.placeType ?? poi.placeType ?? undefined,
            }));
            const highlight = pickHighlight(dayMedia);
            const dayIndex = getDayIndex(dateKey, tripStartDate);
            const dateLabel = formatDateLabel(dateKey);
            const ratings = dayMedia
              .map((m) => m.rating)
              .filter((r): r is number => r != null && r >= 1 && r <= 5);
            const averageRating =
              ratings.length > 0
                ? ratings.reduce((a, b) => a + b, 0) / ratings.length
                : null;
            const alternateMedia = highlight
              ? dayMedia.filter((m) => m.id !== highlight.id)
              : dayMedia;

            const dayExpense = expensesByDay.get(dateKey);
            const totalExpense = dayExpense?.total ?? 0;
            const expenseByCategory = dayExpense?.byCategory ?? {};
            const expenseByCategoryByCurrency = dayExpense?.byCategoryByCurrency ?? {};

            return (
              <DailyCard
                key={dateKey}
                dayIndex={dayIndex}
                dateLabel={dateLabel}
                highlightMedia={highlight}
                alternateMedia={alternateMedia}
                pois={pois}
                totalCount={dayMedia.length}
                averageRating={averageRating}
                totalExpense={totalExpense}
                expenseByCategory={expenseByCategory}
                expenseByCategoryByCurrency={expenseByCategoryByCurrency}
                baseCurrency={baseCurrency}
                participantCount={Math.max(1, participants.length)}
                onSaveReview={handleSaveReview}
                onSaveLocationName={handleSaveLocationName}
                onClearLocation={handleClearLocation}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
