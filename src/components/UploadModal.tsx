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
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-200 bg-white p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Add photo or video</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mb-6 text-sm text-slate-500">Images and videos only · Videos 15 seconds or less</p>
        <MediaUpload activeTripId={activeTripId} onSuccess={handleSuccess} />
      </div>
    </>
  );
}
