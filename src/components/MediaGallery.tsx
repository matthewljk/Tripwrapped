'use client';

import { useCallback, useEffect, useState } from 'react';
import { getUrl } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const dataClient = generateClient<Schema>();
const URL_EXPIRES_IN = 3600;

type MediaItem = {
  id: string;
  path: string;
  url?: string;
  uploadedBy: string;
  uploadedByUsername?: string | null;
};

function isImage(path: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|bmp|svg)$/i.test(path);
}

function isVideo(path: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(path);
}

function downloadFilename(item: MediaItem): string {
  const base = item.path.split('/').pop() || '';
  const hasExt = /\.[a-z0-9]+$/i.test(base);
  if (hasExt) return base;
  const ext = isImage(item.path) ? '.jpg' : isVideo(item.path) ? '.mp4' : '';
  return `tripwrapped-${item.id}${ext}`;
}

function formatLastRefreshed(date: Date): string {
  const now = new Date();
  const sec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

function UploaderAvatar({ username }: { username: string | null | undefined }) {
  const displayName = username?.trim() || '?';
  const initial = (displayName[0] ?? '?').toUpperCase();
  return (
    <div className="group/avatar relative inline-flex">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-600 text-xs font-semibold text-white shadow ring-2 ring-white" aria-label={`Uploaded by ${displayName}`}>
        {initial}
      </div>
      <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-[100] mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/avatar:opacity-100">
        {displayName}
      </span>
    </div>
  );
}

function GalleryToolbar({
  lastRefreshedAt,
  onRefresh,
  refreshLabel,
  loading,
  selectMode,
  onToggleSelectMode,
  selectedCount,
  onSelectAll,
  onClearSelection,
  onDownloadSelected,
  downloadingMultiple,
}: {
  lastRefreshedAt: Date | null;
  onRefresh: () => void;
  refreshLabel: string;
  loading: boolean;
  selectMode?: boolean;
  onToggleSelectMode?: () => void;
  selectedCount?: number;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  onDownloadSelected?: () => void;
  downloadingMultiple?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-slate-500">
        {lastRefreshedAt ? <>Last refreshed {formatLastRefreshed(lastRefreshedAt)}</> : '—'}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {selectMode && selectedCount !== undefined && (
          <>
            <span className="text-sm font-medium text-slate-700">{selectedCount} selected</span>
            <button type="button" onClick={onSelectAll} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Select all
            </button>
            <button type="button" onClick={onClearSelection} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Clear
            </button>
            <button
              type="button"
              onClick={onDownloadSelected}
              disabled={selectedCount === 0 || downloadingMultiple}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {downloadingMultiple ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Downloading…
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download {selectedCount}
                </>
              )}
            </button>
          </>
        )}
        {onToggleSelectMode && (
          <button
            type="button"
            onClick={onToggleSelectMode}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${selectMode ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </button>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
          aria-label="Refresh gallery"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshLabel}
        </button>
      </div>
    </div>
  );
}

type MediaGalleryProps = {
  activeTripId: string;
  activeTrip: { allowAnyMemberToDelete: boolean } | null;
  userId: string | null;
  refreshTrigger?: number;
};

export default function MediaGallery({ activeTripId, activeTrip, userId, refreshTrigger = 0 }: MediaGalleryProps) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [refreshButtonLabel, setRefreshButtonLabel] = useState('Refresh');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingMultiple, setDownloadingMultiple] = useState(false);
  const [, setTick] = useState(0);

  const canDelete = (item: MediaItem) =>
    userId && activeTrip && (item.uploadedBy === userId || activeTrip.allowAnyMemberToDelete);

  const handleDelete = useCallback(
    async (item: MediaItem) => {
      if (!window.confirm('Delete this photo/video? This cannot be undone.')) return;
      setDeletingId(item.id);
      setError(null);
      try {
        if (item.uploadedBy === userId) {
          await dataClient.models.Media.delete({ id: item.id });
          setItems((prev) => prev.filter((i) => i.id !== item.id));
          if (lightboxItem?.id === item.id) setLightboxItem(null);
        } else {
          const { data, errors } = await dataClient.mutations.deleteTripMedia({ mediaId: item.id });
          if (errors?.length) {
            setError(errors.map((e) => e.message).join(' ') || 'Failed to delete');
            return;
          }
          if (data?.success) {
            setItems((prev) => prev.filter((i) => i.id !== item.id));
            if (lightboxItem?.id === item.id) setLightboxItem(null);
          } else {
            setError(data?.message ?? 'Delete was not allowed');
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete');
      } finally {
        setDeletingId(null);
      }
    },
    [userId, lightboxItem?.id]
  );

  useEffect(() => {
    if (!lastRefreshedAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [lastRefreshedAt]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: mediaList } = await dataClient.models.Media.list({
        filter: { tripId: { eq: activeTripId } },
      });
      const withUrls: MediaItem[] = [];
      for (const m of mediaList ?? []) {
        try {
          const { url } = await getUrl({ path: m.storagePath, options: { expiresIn: URL_EXPIRES_IN } });
          withUrls.push({
            id: m.id,
            path: m.storagePath,
            url: url.toString(),
            uploadedBy: m.uploadedBy,
            uploadedByUsername: m.uploadedByUsername ?? null,
          });
        } catch {
          // skip
        }
      }
      setItems(withUrls);
      setLastRefreshedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [activeTripId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems, refreshTrigger]);

  const handleRefresh = useCallback(() => {
    setRefreshButtonLabel('Refreshing…');
    fetchItems().finally(() => setRefreshButtonLabel('Refresh'));
  }, [fetchItems]);

  const openLightbox = useCallback((item: MediaItem) => setLightboxItem(item), []);
  const closeLightbox = useCallback(() => setLightboxItem(null), []);

  const handleDownload = useCallback(async (item: MediaItem) => {
    if (!item.url) return;
    setDownloadingId(item.id);
    try {
      const res = await fetch(item.url, { mode: 'cors' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadFilename(item);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const toggleSelectMode = useCallback(() => {
    setSelectMode((on) => {
      if (on) setSelectedIds(new Set());
      return !on;
    });
  }, []);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(items.map((i) => i.id)));
  }, [items]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleDownloadSelected = useCallback(async () => {
    const toDownload = items.filter((i) => selectedIds.has(i.id) && i.url);
    if (toDownload.length === 0) return;
    setDownloadingMultiple(true);
    for (let i = 0; i < toDownload.length; i++) {
      await handleDownload(toDownload[i]);
      if (i < toDownload.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
    setSelectedIds(new Set());
    setDownloadingMultiple(false);
  }, [items, selectedIds, handleDownload]);

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-12 w-12 animate-pulse rounded-2xl bg-blue-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-10 text-center">
        <p className="text-slate-600">{error}</p>
        <button type="button" onClick={handleRefresh} className="btn-primary">Try again</button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <GalleryToolbar lastRefreshedAt={lastRefreshedAt} onRefresh={handleRefresh} refreshLabel={refreshButtonLabel} loading={loading} />
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl">📷</div>
          <p className="text-lg font-semibold text-slate-900">No photos or videos yet</p>
          <p className="text-slate-600">Add your first from the Upload page.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <GalleryToolbar
        lastRefreshedAt={lastRefreshedAt}
        onRefresh={handleRefresh}
        refreshLabel={refreshButtonLabel}
        loading={loading}
        selectMode={selectMode}
        onToggleSelectMode={toggleSelectMode}
        selectedCount={selectedIds.size}
        onSelectAll={selectAll}
        onClearSelection={clearSelection}
        onDownloadSelected={handleDownloadSelected}
        downloadingMultiple={downloadingMultiple}
      />
      <div className="columns-2 gap-5 pb-24 pt-2 md:columns-3 lg:columns-4 lg:gap-6">
        {items.map((item) => {
          const selected = selectedIds.has(item.id);
          return (
            <div
              key={item.id}
              className="group relative mb-5 block w-full break-inside-avoid lg:mb-6"
            >
              <button
                type="button"
                onClick={() => (selectMode ? toggleSelection(item.id) : openLightbox(item))}
                className={`block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${selectMode && selected ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}
              >
                <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 group-hover:shadow-md">
                  {/* In-flow sizer so the card has height (masonry); invisible so only the layered media shows */}
                  {item.url && isImage(item.path) && (
                    <img src={item.url} alt="" className="w-full object-cover align-top opacity-0 pointer-events-none" aria-hidden />
                  )}
                  {item.url && isVideo(item.path) && (
                    <div className="aspect-video w-full" aria-hidden />
                  )}
                  {item.url && !isImage(item.path) && !isVideo(item.path) && (
                    <div className="aspect-square w-full" aria-hidden />
                  )}
                  {/* Media in its own layer (z-0) so overlay + tooltip always sit on top */}
                  <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
                    {item.url && isImage(item.path) && (
                      <img src={item.url} alt="" className="h-full w-full object-cover align-top transition-transform duration-200 group-hover:scale-[1.02]" />
                    )}
                    {item.url && isVideo(item.path) && (
                      <video src={item.url} className="h-full w-full object-cover align-top transition-transform duration-200 group-hover:scale-[1.02]" muted playsInline preload="metadata" />
                    )}
                    {item.url && !isImage(item.path) && !isVideo(item.path) && (
                      <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-4xl">📎</div>
                    )}
                  </div>
                  {selectMode && (
                    <div className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/70 text-white" aria-hidden>
                      {selected ? (
                        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                      ) : (
                        <div className="h-5 w-5 rounded border-2 border-white" />
                      )}
                    </div>
                  )}
                  {!selectMode && (
                    <div className="absolute bottom-2 left-2 z-10" onClick={(e) => e.stopPropagation()}>
                      <UploaderAvatar username={item.uploadedByUsername} />
                    </div>
                  )}
                  {!selectMode && (
                    <div className="absolute right-2 top-2 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleDownload(item)}
                        disabled={downloadingId === item.id}
                        className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/70 text-white shadow hover:bg-slate-800/80 disabled:opacity-50"
                        aria-label="Download"
                      >
                        {downloadingId === item.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        )}
                      </button>
                      {canDelete(item) && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          disabled={deletingId === item.id}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/70 text-white shadow hover:bg-slate-800/80 disabled:opacity-50"
                          aria-label="Delete"
                        >
                          {deletingId === item.id ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          ) : (
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
      {lightboxItem?.url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm" onClick={closeLightbox}>
          <div className="relative flex max-h-full max-w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {isImage(lightboxItem.path) && <img src={lightboxItem.url} alt="" className="max-h-[90vh] w-auto max-w-full rounded-xl object-contain shadow-2xl" />}
            {isVideo(lightboxItem.path) && <video src={lightboxItem.url} controls autoPlay className="max-h-[90vh] max-w-full rounded-xl shadow-2xl" />}
            <div className="absolute -bottom-12 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleDownload(lightboxItem)}
                disabled={downloadingId === lightboxItem.id}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50"
                aria-label="Download"
              >
                {downloadingId === lightboxItem.id ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                )}
                {downloadingId === lightboxItem.id ? 'Saving…' : 'Save / Download'}
              </button>
              {canDelete(lightboxItem) && (
                <button
                  type="button"
                  onClick={() => handleDelete(lightboxItem)}
                  disabled={deletingId === lightboxItem.id}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deletingId === lightboxItem.id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            </div>
          </div>
          <button type="button" onClick={closeLightbox} className="absolute right-4 top-4 rounded-lg bg-slate-800/80 p-2 text-white hover:bg-slate-700" aria-label="Close">✕</button>
        </div>
      )}
    </>
  );
}
