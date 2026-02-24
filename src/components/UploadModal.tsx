'use client';

import { useCallback } from 'react';
import MediaUpload from './MediaUpload';

type UploadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  activeTripId: string;
  onSuccess: () => void;
};

export default function UploadModal({ isOpen, onClose, activeTripId, onSuccess }: UploadModalProps) {
  const handleSuccess = useCallback(() => {
    onSuccess();
    onClose();
  }, [onSuccess, onClose]);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" aria-hidden onClick={onClose} />
      <div
        className="fixed inset-x-0 bottom-0 top-auto z-50 max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-b-0 border-slate-200 bg-white shadow-xl safe-area-padding safe-area-bottom sm:left-1/2 sm:right-auto sm:top-1/2 sm:bottom-auto sm:max-h-[85vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border-b"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 sm:px-8 sm:pt-8">
          <div className="sticky top-0 z-10 -mx-6 flex items-center justify-between border-b border-slate-100 bg-white px-6 pb-4 pt-0 sm:relative sm:mx-0 sm:border-0 sm:px-0 sm:pb-0">
            <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Add photo or video</h2>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mb-5 text-sm text-slate-500 sm:mb-6">Images and videos only · Videos 15 seconds or less</p>
          <MediaUpload activeTripId={activeTripId} onSuccess={handleSuccess} />
          <div className="pb-8 sm:pb-10" />
        </div>
      </div>
    </>
  );
}
