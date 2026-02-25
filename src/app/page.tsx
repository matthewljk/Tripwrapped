'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import TripSelector from '@/components/TripSelector';
import UploadModal from '@/components/UploadModal';
import TransactionForm from '@/components/TransactionForm';
import { useActiveTrip } from '@/hooks/useActiveTrip';

export default function AddPage() {
  const router = useRouter();
  const { activeTripId, activeTrip, hasTrip, loading, refresh } = useActiveTrip();
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleUploadSuccess = useCallback(() => {}, []);
  const handleTransactionSuccess = useCallback(() => {}, []);

  // Refetch trip data when Add page is shown so saved trip currency (from Trips) is up to date
  useEffect(() => {
    if (hasTrip) refresh();
  }, [hasTrip, refresh]);

  useEffect(() => {
    if (!loading && !hasTrip) router.replace('/trips');
  }, [loading, hasTrip, router]);

  if (loading) return <LoadingSpinner />;

  if (!hasTrip) return <LoadingSpinner />;

  if (!activeTripId) return <LoadingSpinner />;

  return (
    <>
      <div className="h-14 sm:h-16" />
      <div className="mx-auto max-w-6xl px-6 pb-24 sm:pb-0 sm:px-6 safe-area-padding content-wrap">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 py-4 sm:py-6">
          <TripSelector />
        </div>

        {/* Section 1: Add photo or video — one click opens upload */}
        <section className="border-b border-slate-100 py-6 sm:py-10">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Photo or video</h2>
          <p className="mt-1 text-sm sm:text-base text-slate-600">Add photos and videos to your trip. Images and short videos (15s or less) only.</p>
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="btn-primary mt-4 w-full sm:w-auto"
          >
            Add photo or video
          </button>
        </section>

        {/* Section 2: Add transaction — form shown directly, no menu */}
        <section className="py-6 sm:py-10">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Add transaction</h2>
          <p className="mt-1 text-sm sm:text-base text-slate-600">Log an expense and split it with trip members.</p>
          <div className="mt-4 sm:mt-6 w-full max-w-xl">
            <TransactionForm
              activeTripId={activeTripId}
              baseCurrency={activeTrip?.baseCurrency ?? null}
              onSuccess={handleTransactionSuccess}
            />
          </div>
        </section>
      </div>

      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        activeTripId={activeTripId}
        onSuccess={handleUploadSuccess}
      />
    </>
  );
}
