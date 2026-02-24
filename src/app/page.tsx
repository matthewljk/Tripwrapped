'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import TripSelector from '@/components/TripSelector';
import UploadModal from '@/components/UploadModal';
import { useActiveTrip } from '@/hooks/useActiveTrip';

export default function UploadPage() {
  const { activeTripId, hasTrip, loading } = useActiveTrip();
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleUploadSuccess = useCallback(() => {}, []);

  if (loading) return <LoadingSpinner />;

  if (!hasTrip) {
    return (
      <div className="flex min-h-dscreen-half flex-col items-center justify-center bg-slate-50 px-4 py-16 safe-area-padding sm:min-h-dscreen sm:py-24">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Start with a trip</h2>
          <p className="mt-3 text-slate-600">Create or join a trip to add photos and videos. Share the code with friends so everyone can contribute.</p>
          <Link href="/trips" className="btn-primary mt-8 inline-block">Create or join a trip</Link>
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
        <section className="py-8 sm:py-12">
          <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Upload</h1>
          <p className="mt-2 text-slate-600">Add photos and videos to your default trip above. Images and short videos (15s or less) only.</p>
          <button type="button" onClick={() => setUploadOpen(true)} className="btn-primary mt-6 sm:mt-8">Add photo or video</button>
        </section>
      </div>
      <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} activeTripId={activeTripId} onSuccess={handleUploadSuccess} />
    </>
  );
}
