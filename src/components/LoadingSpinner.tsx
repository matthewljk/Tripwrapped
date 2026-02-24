'use client';

/**
 * Mobile-first loading state: compact, centered, respects safe area.
 * Uses dynamic viewport units (dvh) so height adapts when browser chrome shows/hides.
 */
export default function LoadingSpinner() {
  return (
    <div
      className="flex items-center justify-center px-4 py-12 safe-area-padding"
      style={{ minHeight: 'min(50dvh, 100dvh - 8rem)' }}
    >
      <div
        className="h-10 w-10 animate-pulse rounded-xl bg-blue-200 sm:h-12 sm:w-12"
        aria-hidden
      />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
