'use client';

import { useCallback, useState } from 'react';
import { useWrapRecapData } from '@/hooks/useWrapRecapData';
import TripVideoCompiler from '@/components/TripVideoCompiler';
import WrapRecapMediaSelector from '@/components/WrapRecapMediaSelector';
import { filterRecapByExcluded } from '@/lib/wrapRecap';
import { DEFAULT_CURRENCY } from '@/lib/constants';

function formatTripDates(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  const s = start ? new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '?';
  const e = end ? new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '?';
  return start && end ? `${s} – ${e}` : s;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || DEFAULT_CURRENCY,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

type Props = {
  activeTripId: string | null;
};

export default function WrapRecap({ activeTripId }: Props) {
  const { data, loading, error } = useWrapRecapData(activeTripId);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());

  const toggleIncluded = useCallback((id: string) => {
    setExcludedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" aria-hidden />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-6 text-amber-800">
        <p className="font-medium">Could not load recap</p>
        <p className="mt-1 text-sm">{error}</p>
      </div>
    );
  }

  if (!data || (data.days.length === 0 && data.stats.totalPhotos === 0 && data.stats.totalVideos === 0)) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-slate-600">
        <p className="font-medium">No media yet</p>
        <p className="mt-1 text-sm">Add photos and videos to your trip to see your recap here.</p>
      </div>
    );
  }

  const { stats } = data;

  return (
    <div className="space-y-8">
      {/* Stats */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Your trip at a glance</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Dates</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 sm:text-base">
              {formatTripDates(stats.tripStartDate, stats.tripEndDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Photos</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 sm:text-base">{stats.totalPhotos}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Videos</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 sm:text-base">{stats.totalVideos}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Expenses</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 sm:text-base">
              {formatCurrency(stats.totalExpense, stats.baseCurrency)}
            </dd>
          </div>
        </dl>
        {stats.distanceKm > 0 && (
          <p className="mt-3 text-sm text-slate-600">
            Distance covered: <strong>{stats.distanceKm.toFixed(1)} km</strong>
          </p>
        )}
      </section>

      {/* Choose which media to include */}
      <WrapRecapMediaSelector
        recapData={data}
        excludedIds={excludedIds}
        onToggle={toggleIncluded}
      />

      {/* Compile video on the spot (Spotify-style) */}
      <TripVideoCompiler recapData={filterRecapByExcluded(data, excludedIds)} />
    </div>
  );
}
