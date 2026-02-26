'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import TripSelector from '@/components/TripSelector';
import UploadModal from '@/components/UploadModal';
import TransactionForm from '@/components/TransactionForm';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { DEFAULT_CURRENCY } from '@/lib/constants';

export default function AddPage() {
  const router = useRouter();
  const { activeTripId, activeTrip, hasTrip, loading, refresh } = useActiveTrip();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [addTransactionExpanded, setAddTransactionExpanded] = useState(false);

  const handleUploadSuccess = useCallback(() => {}, []);
  const handleTransactionSuccess = useCallback(() => {}, []);

  // Refetch trip data when Add page is shown so saved trip currency (from Trips) is up to date
  useEffect(() => {
    if (hasTrip) refresh();
  }, [hasTrip, refresh]);

  // When user expands Add transaction, refetch so form gets latest trip currency
  useEffect(() => {
    if (addTransactionExpanded && hasTrip) refresh();
  }, [addTransactionExpanded, hasTrip, refresh]);

  useEffect(() => {
    if (!loading && !hasTrip) router.replace('/trips');
  }, [loading, hasTrip, router]);

  if (loading) return <LoadingSpinner />;

  if (!hasTrip) return <LoadingSpinner />;

  if (!activeTripId) return <LoadingSpinner />;

  // Prefer sessionStorage (saved in Trip settings in this browser) so production shows correct currency after refresh even when API is slow or stale
  const storedCurrency =
    typeof window !== 'undefined' && activeTripId
      ? sessionStorage.getItem(`tripwrapped-trip-currency-${activeTripId}`)
      : null;
  const baseCurrencyForForm = storedCurrency ?? activeTrip?.baseCurrency ?? DEFAULT_CURRENCY;

  return (
    <>
      <div className="h-14 sm:h-16" />
      <div className="mx-auto max-w-6xl content-padding-x pb-24 sm:pb-0 content-wrap">
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

        {/* Section 2: Add transaction — click to expand */}
        <section className="py-6 sm:py-10">
          <button
            type="button"
            onClick={() => setAddTransactionExpanded((e) => !e)}
            className="flex w-full items-start gap-3 text-left"
            aria-expanded={addTransactionExpanded}
          >
            <span
              className="mt-1 flex-shrink-0 text-slate-400 transition-transform"
              style={{ transform: addTransactionExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              aria-hidden
            >
              ▶
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">Add transaction</h2>
              <p className="mt-1 text-sm sm:text-base text-slate-600">Log an expense and split it with trip members.</p>
            </div>
          </button>
          {addTransactionExpanded && (
            <div className="mt-4 sm:mt-6 w-full max-w-xl pl-6 sm:pl-8">
              <TransactionForm
                activeTripId={activeTripId}
                baseCurrency={baseCurrencyForForm}
                onSuccess={handleTransactionSuccess}
              />
            </div>
          )}
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
