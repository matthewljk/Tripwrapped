'use client';

import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import TripMap from '@/components/TripMap';
import TripSelector from '@/components/TripSelector';
import { useActiveTrip } from '@/hooks/useActiveTrip';

export default function WrapItUpPage() {
  const { activeTripId, hasTrip, loading } = useActiveTrip();
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

  if (loading) return <LoadingSpinner />;

  if (!hasTrip) {
    return (
      <div className="flex min-h-dscreen-half flex-col items-center justify-center bg-slate-50 px-4 py-16 safe-area-padding sm:min-h-dscreen sm:py-24">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create or join a trip</h2>
          <p className="mt-3 text-slate-600">Trips have a shared gallery and map. Create or join a trip to see locations.</p>
          <Link href="/trips" className="btn-primary mt-8 inline-block">Create or join a trip</Link>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-dscreen-half flex-col items-center justify-center bg-slate-50 px-4 py-16 safe-area-padding">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Map not configured</h2>
          <p className="mt-3 text-slate-600">Set <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm">.env.local</code> to show the trip map.</p>
        </div>
      </div>
    );
  }

  if (!activeTripId) return <LoadingSpinner />;

  return (
    <>
      <div className="h-14 sm:h-16" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6 safe-area-padding">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-6">
          <TripSelector />
        </div>
      </div>
      <div className="h-[calc(100dvh-8rem)] min-h-[320px] w-full">
        <TripMap activeTripId={activeTripId} mapboxAccessToken={token} />
      </div>
    </>
  );
}
