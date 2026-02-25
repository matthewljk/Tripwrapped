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
      <div className="flex min-h-dscreen-half flex-col items-center justify-center bg-slate-50 px-6 py-16 safe-area-padding content-wrap sm:min-h-dscreen sm:py-24">
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
      <div className="flex min-h-dscreen-half flex-col items-center justify-center bg-slate-50 px-6 py-16 safe-area-padding content-wrap">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Map not configured</h2>
          <p className="mt-3 text-slate-600">
            Add your Mapbox token so the trip map can load.
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-slate-600">
            <li><strong>Local:</strong> In the project root, create or edit <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code> with <code className="rounded bg-slate-100 px-1 py-0.5">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.eyJ...</code></li>
            <li><strong>Amplify (production):</strong> In Amplify Console → App → Environment variables, add <code className="rounded bg-slate-100 px-1 py-0.5">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> and redeploy.</li>
          </ul>
          <p className="mt-3 text-sm text-slate-500">
            Get a token at <a href="https://account.mapbox.com/access-tokens/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">account.mapbox.com/access-tokens</a>.
          </p>
        </div>
      </div>
    );
  }

  if (!activeTripId) return <LoadingSpinner />;

  return (
    <>
      <div className="h-14 sm:h-16" />
      <div className="mx-auto max-w-6xl px-6 sm:px-6 safe-area-padding content-wrap">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-4 sm:py-6">
          <TripSelector />
        </div>
      </div>
      <div className="h-[calc(100dvh-9rem)] min-h-[280px] w-full sm:min-h-[320px]">
        <TripMap activeTripId={activeTripId} mapboxAccessToken={token} />
      </div>
    </>
  );
}
