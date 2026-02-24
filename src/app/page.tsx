'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import TripSelector from '@/components/TripSelector';
import UploadModal from '@/components/UploadModal';
import { useActiveTrip } from '@/hooks/useActiveTrip';

export default function UploadPage() {
  const router = useRouter();
  const { activeTripId, hasTrip, loading } = useActiveTrip();
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleUploadSuccess = useCallback(() => {}, []);

  useEffect(() => {
    if (!loading && !hasTrip) router.replace('/trips');
  }, [loading, hasTrip, router]);

  if (loading) return <LoadingSpinner />;

  if (!hasTrip) return <LoadingSpinner />;

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
