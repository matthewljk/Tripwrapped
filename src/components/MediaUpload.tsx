'use client';

import { useCallback, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { uploadData } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useUserProfile } from '@/hooks/useUserProfile';

const dataClient = generateClient<Schema>();
const MAX_VIDEO_DURATION_SEC = 15;
const ACCEPTED_TYPES = 'image/*,video/*';

function getSafeFilename(file: File): string {
  const base = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
  const nameWithoutExt = base.slice(0, base.length - ext.length) || 'file';
  return `${nameWithoutExt}_${Date.now()}${ext}`;
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
    };
    video.addEventListener('loadedmetadata', () => {
      cleanup();
      resolve(video.duration);
    });
    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('Could not read video duration'));
    });
    video.src = url;
  });
}

type MediaUploadProps = {
  activeTripId: string;
  onSuccess?: () => void;
};

export default function MediaUpload({ activeTripId, onSuccess }: MediaUploadProps) {
  const { username: displayName } = useUserProfile();
  const [status, setStatus] = useState<'idle' | 'validating' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const validateAndUpload = useCallback(
    async (file: File) => {
      setErrorMessage(null);
      const isVideo = file.type.startsWith('video/');
      if (isVideo) {
        setStatus('validating');
        try {
          const duration = await getVideoDuration(file);
          if (duration > MAX_VIDEO_DURATION_SEC) {
            setStatus('error');
            setErrorMessage(`Video must be 15 seconds or less. This video is ${Math.ceil(duration)} seconds.`);
            return;
          }
        } catch {
          setStatus('error');
          setErrorMessage('Could not read video duration.');
          return;
        }
      }
      setStatus('uploading');
      setProgress(0);
      const filename = getSafeFilename(file);
      let storagePath = '';
      try {
        await uploadData({
          path: ({ identityId }) => {
            storagePath = `media/${identityId}/${filename}`;
            return storagePath;
          },
          data: file,
          options: {
            contentType: file.type,
            onProgress: ({ transferredBytes, totalBytes }) => {
              if (totalBytes && totalBytes > 0)
                setProgress(Math.round((transferredBytes / totalBytes) * 100));
            },
          },
        }).result;
        const { userId } = await getCurrentUser();
        await dataClient.models.Media.create({
          tripId: activeTripId,
          storagePath,
          uploadedBy: userId,
          uploadedByUsername: displayName ?? undefined,
        });
        setStatus('success');
        setProgress(100);
        onSuccess?.();
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [activeTripId, onSuccess, displayName]
  );

  const handleFile = useCallback(
    (file: File | null) => {
      if (!file) return;
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        setStatus('error');
        setErrorMessage('Only images and videos are allowed.');
        return;
      }
      validateAndUpload(file);
    },
    [validateAndUpload]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0] ?? null);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFile(e.target.files?.[0] ?? null);
      e.target.value = '';
    },
    [handleFile]
  );

  return (
    <div className="w-full space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative min-h-[220px] flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-all duration-200 ${
          isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
        } ${status === 'uploading' ? 'border-blue-400 bg-blue-50' : ''} ${status === 'error' ? 'border-red-300 bg-red-50' : ''} ${status === 'success' ? 'border-emerald-300 bg-emerald-50' : ''}`}
      >
        <input
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleChange}
          disabled={status === 'uploading' || status === 'validating'}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label="Choose photo or video"
        />
        {status === 'idle' && (
          <p className="text-center text-sm text-slate-600">Drop a photo or video here, or click to choose</p>
        )}
        {status === 'validating' && <p className="text-sm text-slate-600">Checking video length…</p>}
        {status === 'uploading' && (
          <div className="w-full max-w-xs space-y-2">
            <div className="h-2.5 w-full overflow-hidden rounded-xl bg-slate-200">
              <div className="h-2.5 rounded-xl bg-blue-600 transition-[width] duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-center text-sm text-slate-600">{progress}%</p>
          </div>
        )}
        {status === 'success' && <p className="text-sm font-medium text-emerald-700">Uploaded.</p>}
        {status === 'error' && errorMessage && (
          <p className="text-center text-sm font-medium text-red-600">{errorMessage}</p>
        )}
      </div>
    </div>
  );
}
