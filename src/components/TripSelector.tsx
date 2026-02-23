'use client';

import Link from 'next/link';
import { useActiveTrip } from '@/hooks/useActiveTrip';

export default function TripSelector() {
  const { trips, activeTripId, activeTrip, setActiveTripId, loading, hasTrip } = useActiveTrip();

  if (loading || !hasTrip) return null;
  if (!activeTripId || !activeTrip) return null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="rounded-xl bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">
        {activeTrip.name || activeTrip.tripCode}
      </span>
      <span className="text-sm text-slate-500">
        Code: <span className="font-mono font-medium text-slate-700">{activeTrip.tripCode}</span>
      </span>
      {trips.length > 1 && (
        <>
          <span className="text-slate-300">·</span>
          <label htmlFor="trip-select-default" className="sr-only">Default trip</label>
          <select
            id="trip-select-default"
            value={activeTripId}
            onChange={(e) => setActiveTripId(e.target.value || null)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
          >
            {trips.map((t) => (
              <option key={t.id} value={t.id}>{t.name || t.tripCode}</option>
            ))}
          </select>
        </>
      )}
      <Link href="/trips" className="text-sm font-medium text-blue-600 hover:text-blue-800">
        Manage trips
      </Link>
    </div>
  );
}
