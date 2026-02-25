'use client';

import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import MediaGallery from '@/components/MediaGallery';
import TripSelector from '@/components/TripSelector';
import { useActiveTrip } from '@/hooks/useActiveTrip';

export default function GalleryPage() {
  const { activeTripId, activeTrip, userId, hasTrip, loading } = useActiveTrip();

  if (loading) return <LoadingSpinner />;

  if (!hasTrip) {
    return (
      <div className="flex min-h-dscreen-half flex-col items-center justify-center bg-slate-50 px-6 py-16 safe-area-padding content-wrap sm:min-h-dscreen sm:py-24">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Create or join a trip</h2>
          <p className="mt-3 text-slate-600">Trips have a shared gallery. Create or join a trip to see photos and videos.</p>
          <Link href="/trips" className="btn-primary mt-8 inline-block">Create or join a trip</Link>
        </div>
      </div>
    );
  }

  if (!activeTripId) return <LoadingSpinner />;

  return (
    <>
      <div className="h-14 sm:h-16" />
      <div className="mx-auto max-w-6xl min-w-0 overflow-x-hidden px-6 pb-24 sm:pb-0 sm:px-6 safe-area-padding content-wrap">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-4 sm:py-6">
          <TripSelector />
        </div>
        <section className="min-w-0 overflow-x-hidden py-4 sm:py-8">
          <h1 className="sr-only">Gallery</h1>
          <MediaGallery activeTripId={activeTripId} activeTrip={activeTrip} userId={userId} />
        </section>
      </div>
    </>
  );
}
