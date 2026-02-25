'use client';

import Link from 'next/link';
import { useActiveTrip } from '@/hooks/useActiveTrip';

export default function TripSelector() {
  const { trips, activeTripId, activeTrip, setActiveTripId, loading, hasTrip } = useActiveTrip();

  if (loading || !hasTrip) return null;
  if (!activeTripId || !activeTrip) return null;

  const tripName = activeTrip.name || activeTrip.tripCode;
  const canSwitchTrip = trips.length > 1;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
      {canSwitchTrip ? (
        <label
          htmlFor="trip-select-default"
          className="cursor-pointer rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100 focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2 sm:px-4"
        >
          <span className="block max-w-[140px] truncate sm:max-w-none">{tripName}</span>
        </label>
      ) : (
        <span className="max-w-[140px] truncate rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 sm:max-w-none sm:px-4">
          {tripName}
        </span>
      )}
      <span className="text-xs text-slate-500 sm:text-sm">
        Code: <span className="font-mono font-medium text-slate-700">{activeTrip.tripCode}</span>
      </span>
      {canSwitchTrip && (
        <>
          <span className="hidden text-slate-300 sm:inline">·</span>
          <select
            id="trip-select-default"
            value={activeTripId}
            onChange={(e) => setActiveTripId(e.target.value || null)}
            className="min-h-[44px] min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 sm:max-w-[200px] sm:flex-initial sm:px-4 sm:py-3 sm:text-base"
            aria-label="Active trip"
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>{t.name || t.tripCode}</option>
            ))}
          </select>
        </>
      )}
      <Link href="/trips" className="min-h-[44px] shrink-0 inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-800 sm:text-sm">
        Manage trips
      </Link>
    </div>
  );
}
