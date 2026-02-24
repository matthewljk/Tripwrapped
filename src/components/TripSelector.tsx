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
    <div className="flex flex-wrap items-center gap-3">
      {canSwitchTrip ? (
        <label
          htmlFor="trip-select-default"
          className="cursor-pointer rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 transition-colors hover:bg-blue-100 focus-within:ring-2 focus-within:ring-blue-600 focus-within:ring-offset-2"
        >
          {tripName}
        </label>
      ) : (
        <span className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
          {tripName}
        </span>
      )}
      <span className="text-sm text-slate-500">
        Code: <span className="font-mono font-medium text-slate-700">{activeTrip.tripCode}</span>
      </span>
      {canSwitchTrip && (
        <>
          <span className="text-slate-300">·</span>
          <select
            id="trip-select-default"
            value={activeTripId}
            onChange={(e) => setActiveTripId(e.target.value || null)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            aria-label="Active trip"
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>{t.name || t.tripCode}</option>
            ))}
          </select>
        </>
      )}
      <Link href="/trips" className="min-h-[44px] inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800">
        Manage trips
      </Link>
    </div>
  );
}
