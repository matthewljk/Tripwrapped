'use client';

import Link from 'next/link';
import MediaGallery from '@/components/MediaGallery';
import TripSelector from '@/components/TripSelector';
import { useActiveTrip } from '@/hooks/useActiveTrip';

export default function GalleryPage() {
  const { activeTripId, activeTrip, userId, hasTrip, loading } = useActiveTrip();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-blue-200" />
      </div>
    );
  }

  if (!hasTrip) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-24">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create or join a trip</h2>
          <p className="mt-3 text-slate-600">Trips have a shared gallery. Create or join a trip to see photos and videos.</p>
          <Link href="/trips" className="btn-primary mt-8 inline-block">Create or join a trip</Link>
        </div>
      </div>
    );
  }

  if (!activeTripId) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-blue-200" />
      </div>
    );
  }

  return (
    <>
      <div className="h-16" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-6">
          <TripSelector />
        </div>
        <section className="py-8">
          <h1 className="sr-only">Gallery</h1>
          <MediaGallery activeTripId={activeTripId} activeTrip={activeTrip} userId={userId} />
        </section>
      </div>
    </>
  );
}
