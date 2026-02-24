'use client';

import { useCallback, useEffect, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { uploadData, remove, getUrl } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { useUserProfile } from '@/hooks/useUserProfile';
import exifr from 'exifr';

const dataClient = generateClient<Schema>();
const MAX_VIDEO_DURATION_SEC = 15;
const ACCEPTED_TYPES = 'image/*,video/*';
const THUMBNAIL_URL_EXPIRES_IN = 3600;

type ExtractedMetadata = {
  lat: number | null;
  lng: number | null;
  timestamp: string | null;
};

function getSafeFilename(file: File, index?: number): string {
  const base = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = base.includes('.') ? base.slice(base.lastIndexOf('.')) : '';
  const nameWithoutExt = base.slice(0, base.length - ext.length) || 'file';
  const suffix = index !== undefined ? `_${index}` : '';
  return `${nameWithoutExt}_${Date.now()}${suffix}${ext}`;
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

async function extractImageMetadata(file: File): Promise<ExtractedMetadata> {
  const result: ExtractedMetadata = { lat: null, lng: null, timestamp: null };
  try {
    const [gps, exif] = await Promise.all([
      exifr.gps(file).catch(() => null),
      exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] }).catch(() => null),
    ]);
    if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
      result.lat = gps.latitude;
      result.lng = gps.longitude;
    }
    const dateValue = exif?.DateTimeOriginal ?? exif?.CreateDate;
    if (dateValue instanceof Date && !Number.isNaN(dateValue.getTime())) {
      result.timestamp = dateValue.toISOString();
    }
  } catch {
    // Leave all null on any parse error
  }
  return result;
}

type RecentlyUploadedItem = {
  id: string;
  storagePath: string;
  isVideo: boolean;
};

type MediaUploadProps = {
  activeTripId: string;
  onSuccess?: () => void;
};

export default function MediaUpload({ activeTripId, onSuccess }: MediaUploadProps) {
  const { username: displayName } = useUserProfile();
  const [status, setStatus] = useState<'idle' | 'validating' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadTotal, setUploadTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [recentlyUploaded, setRecentlyUploaded] = useState<RecentlyUploadedItem[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const uploadOne = useCallback(
    async (file: File, metadata: ExtractedMetadata, index: number, total: number): Promise<RecentlyUploadedItem | null> => {
      const isVideo = file.type.startsWith('video/');
      const filename = getSafeFilename(file, index);
      let storagePath = '';

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
      const { data: created } = await dataClient.models.Media.create({
        tripId: activeTripId,
        storagePath,
        uploadedBy: userId,
        uploadedByUsername: displayName ?? undefined,
        lat: metadata.lat ?? undefined,
        lng: metadata.lng ?? undefined,
        timestamp: metadata.timestamp ?? undefined,
      });

      if (created?.id) {
        return { id: created.id, storagePath, isVideo };
      }
      return null;
    },
    [activeTripId, displayName]
  );

  const validateAndUpload = useCallback(
    async (files: File[]) => {
      setErrorMessage(null);
      setDeleteError(null);
      const valid: { file: File; metadata: ExtractedMetadata }[] = [];
      const errors: string[] = [];

      setStatus('validating');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        if (!isImage && !isVideo) {
          errors.push(`${file.name}: not an image or video`);
          continue;
        }
        if (isVideo) {
          try {
            const duration = await getVideoDuration(file);
            if (duration > MAX_VIDEO_DURATION_SEC) {
              errors.push(`${file.name}: over 15 seconds`);
              continue;
            }
          } catch {
            errors.push(`${file.name}: could not read duration`);
            continue;
          }
        }
        const metadata: ExtractedMetadata = isImage ? await extractImageMetadata(file) : { lat: null, lng: null, timestamp: null };
        valid.push({ file, metadata });
      }

      if (valid.length === 0) {
        setStatus('error');
        setErrorMessage(errors.length === files.length ? errors[0] : `${errors.length} file(s) skipped: ${errors.slice(0, 2).join('; ')}${errors.length > 2 ? '…' : ''}`);
        return;
      }
      if (errors.length > 0) {
        setErrorMessage(`${errors.length} file(s) skipped: ${errors.slice(0, 2).join('; ')}${errors.length > 2 ? '…' : ''}`);
      } else {
        setErrorMessage(null);
      }

      setStatus('uploading');
      setUploadTotal(valid.length);
      const uploaded: RecentlyUploadedItem[] = [];

      try {
        for (let i = 0; i < valid.length; i++) {
          setUploadIndex(i + 1);
          setProgress(0);
          const item = await uploadOne(valid[i].file, valid[i].metadata, i, valid.length);
          if (item) uploaded.push(item);
        }
        setRecentlyUploaded((prev) => [...uploaded, ...prev]);
        setProgress(100);
        setStatus('success');
        onSuccess?.();
      } catch (err) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [uploadOne, onSuccess]
  );

  const handleDelete = useCallback(async (mediaId: string, s3Path: string) => {
    setDeleteError(null);
    setDeletingId(mediaId);
    try {
      try {
        await remove({ path: s3Path });
      } catch (s3Err: unknown) {
        const msg = s3Err instanceof Error ? s3Err.message : String(s3Err);
        if (msg.includes('404') || msg.includes('NoSuchKey') || msg.toLowerCase().includes('not found')) {
          // File already gone; proceed to delete DB record
        } else {
          setDeleteError('Could not remove file from storage. Try again.');
          return;
        }
      }

      await dataClient.models.Media.delete({ id: mediaId });
      setRecentlyUploaded((prev) => prev.filter((i) => i.id !== mediaId));
      onSuccess?.();
    } catch (dbErr) {
      setDeleteError(
        'File was removed from storage but could not remove from gallery. Try Delete again or refresh.'
      );
      // Keep item in list so user can retry (next retry will hit S3 404 then DB delete)
    } finally {
      setDeletingId(null);
    }
  }, [onSuccess]);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const files = Array.from(fileList);
      validateAndUpload(files);
    },
    [validateAndUpload]
  );

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

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
      handleFiles(e.target.files);
      e.target.value = '';
    },
    [handleFiles]
  );

  return (
    <div className="w-full space-y-6">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`relative flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-8 transition-all duration-200 ${
          isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
        } ${status === 'uploading' ? 'border-blue-400 bg-blue-50' : ''} ${status === 'error' ? 'border-red-300 bg-red-50' : ''} ${status === 'success' ? 'border-emerald-300 bg-emerald-50' : ''}`}
      >
        <input
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          onChange={handleChange}
          disabled={status === 'uploading' || status === 'validating'}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          aria-label="Choose photos or videos"
        />
        {status === 'idle' && (
          <p className="text-center text-sm text-slate-600">Drop photos or videos here, or click to choose multiple</p>
        )}
        {status === 'validating' && (
          <p className="text-sm text-slate-600">Validating…</p>
        )}
        {status === 'uploading' && (
          <div className="w-full max-w-xs space-y-2">
            {uploadTotal > 1 && (
              <p className="text-center text-sm font-medium text-slate-700">File {uploadIndex} of {uploadTotal}</p>
            )}
            <div className="h-2.5 w-full overflow-hidden rounded-xl bg-slate-200">
              <div
                className="h-2.5 rounded-xl bg-blue-600 transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-sm text-slate-600">{progress}%</p>
          </div>
        )}
        {status === 'success' && (
          <p className="text-sm font-medium text-emerald-700">
            {uploadTotal > 1 ? `${uploadTotal} file(s) uploaded.` : 'Uploaded.'}
          </p>
        )}
        {status === 'error' && errorMessage && (
          <p className="text-center text-sm font-medium text-red-600">{errorMessage}</p>
        )}
      </div>

      {deleteError && (
        <p className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">{deleteError}</p>
      )}

      {recentlyUploaded.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Recently uploaded</h3>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {recentlyUploaded.map((item) => (
              <RecentlyUploadedThumbnail
                key={item.id}
                item={item}
                onDelete={() => handleDelete(item.id, item.storagePath)}
                deleting={deletingId === item.id}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RecentlyUploadedThumbnail({
  item,
  onDelete,
  deleting,
}: {
  item: RecentlyUploadedItem;
  onDelete: () => void;
  deleting: boolean;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbError, setThumbError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getUrl({ path: item.storagePath, options: { expiresIn: THUMBNAIL_URL_EXPIRES_IN } })
      .then(({ url }) => {
        if (!cancelled) setThumbUrl(url.toString());
      })
      .catch(() => {
        if (!cancelled) setThumbError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [item.storagePath]);

  return (
    <li className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      <div className="aspect-square w-full">
        {thumbUrl && !thumbError && item.isVideo && (
          <video src={thumbUrl} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        )}
        {thumbUrl && !thumbError && !item.isVideo && (
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        )}
        {(thumbError || !thumbUrl) && (
          <div className="flex h-full w-full items-center justify-center text-3xl text-slate-400">
            {item.isVideo ? '🎬' : '🖼'}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className="absolute bottom-1 right-1 rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white shadow hover:bg-red-700 disabled:opacity-60"
      >
        {deleting ? '…' : 'Delete'}
      </button>
    </li>
  );
}
