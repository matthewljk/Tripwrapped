'use client';

import { useCallback, useEffect, useState, memo } from 'react';
import { getUrl } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const dataClient = generateClient<Schema>();
const URL_EXPIRES_IN = 3600;
const INITIAL_DISPLAY_COUNT = 10;
const LOAD_MORE_COUNT = 10;
const LIST_CACHE_KEY_PREFIX = 'gallery-list-';
const LIST_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

type MediaItem = {
  id: string;
  path: string;
  url?: string;
  uploadedBy: string;
  uploadedByUsername?: string | null;
  lat?: number | null;
  lng?: number | null;
  timestamp?: string | null;
  isFavorite?: boolean | null;
  locationName?: string | null;
  rating?: number | null;
  review?: string | null;
  visited?: boolean | null;
};

function isImage(path: string): boolean {
  return /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic)$/i.test(path);
}

function isHeic(path: string): boolean {
  return /\.(heic|heif)$/i.test(path ?? '');
}

function isVideo(path: string): boolean {
  return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(path);
}

type SortOption = 'date-desc' | 'date-asc' | 'type-desc' | 'type-asc' | 'user-asc' | 'user-desc' | 'favorites-first';

function sortMediaItems<T extends { path: string; timestamp?: string | null; uploadedByUsername?: string | null; isFavorite?: boolean | null }>(
  list: T[],
  sort: SortOption
): T[] {
  const arr = [...list];
  switch (sort) {
    case 'date-desc':
      return arr.sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''));
    case 'date-asc':
      return arr.sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''));
    case 'type-desc':
      return arr.sort((a, b) => (isVideo(b.path) ? 1 : 0) - (isVideo(a.path) ? 1 : 0)); // photos first
    case 'type-asc':
      return arr.sort((a, b) => (isVideo(a.path) ? 1 : 0) - (isVideo(b.path) ? 1 : 0)); // videos first
    case 'user-asc':
      return arr.sort((a, b) => (a.uploadedByUsername ?? '').localeCompare(b.uploadedByUsername ?? ''));
    case 'user-desc':
      return arr.sort((a, b) => (b.uploadedByUsername ?? '').localeCompare(a.uploadedByUsername ?? ''));
    case 'favorites-first':
      return arr.sort((a, b) => {
        const aFav = a.isFavorite ? 1 : 0;
        const bFav = b.isFavorite ? 1 : 0;
        if (bFav !== aFav) return bFav - aFav;
        return (b.timestamp ?? '').localeCompare(a.timestamp ?? '');
      });
    default:
      return arr;
  }
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

function MetadataThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const skipLoad = isHeic(path);
  useEffect(() => {
    if (!path || skipLoad) return;
    let cancelled = false;
    getUrl({ path, options: { expiresIn: URL_EXPIRES_IN } })
      .then(({ url: u }) => {
        if (!cancelled) setUrl(u.toString());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [path, skipLoad]);
  if (!url) {
    return (
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400" aria-hidden>
        <span className="text-lg">{skipLoad ? '🖼' : '📷'}</span>
      </div>
    );
  }
  return (
    <div className="h-11 w-11 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
      {isImage(path) && !skipLoad ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : isVideo(path) ? (
        <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" aria-hidden />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-lg">📷</div>
      )}
    </div>
  );
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

type GalleryCardProps = {
  item: MediaItem;
  selected: boolean;
  selectMode: boolean;
  downloadingId: string | null;
  deletingId: string | null;
  favoritingId: string | null;
  canDelete: boolean;
  onCardClick: (item: MediaItem) => void;
  onToggleSelection: (id: string) => void;
  onDownload: (item: MediaItem) => void;
  onDelete: (item: MediaItem) => void;
  onToggleFavorite: (item: MediaItem) => void;
};

const GalleryCard = memo(function GalleryCard({
  item,
  selected,
  selectMode,
  downloadingId,
  deletingId,
  favoritingId,
  canDelete,
  onCardClick,
  onToggleSelection,
  onDownload,
  onDelete,
  onToggleFavorite,
}: GalleryCardProps) {
  const isFav = Boolean(item.isFavorite);
  return (
    <div className="group relative mb-5 block w-full break-inside-avoid lg:mb-6">
      <div
        role="button"
        tabIndex={0}
        onClick={() => (selectMode ? onToggleSelection(item.id) : item.url ? onCardClick(item) : undefined)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (selectMode) onToggleSelection(item.id);
            else if (item.url) onCardClick(item);
          }
        }}
        className={`block w-full cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${selectMode && selected ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}
      >
        <div className="relative rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow duration-200 group-hover:shadow-md">
          {!item.url ? (
            <div className="aspect-square w-full rounded-2xl bg-slate-100 animate-pulse" aria-hidden />
          ) : (
            <>
              {isImage(item.path) && (
                <img src={item.url} alt="" loading="lazy" decoding="async" className="w-full object-cover align-top opacity-0 pointer-events-none" aria-hidden />
              )}
              {isVideo(item.path) && (
                <div className="aspect-video w-full" aria-hidden />
              )}
              {!isImage(item.path) && !isVideo(item.path) && (
                <div className="aspect-square w-full" aria-hidden />
              )}
              <div className="absolute inset-0 z-0 overflow-hidden rounded-2xl">
                {isImage(item.path) && (
                  <img src={item.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover align-top transition-transform duration-200 group-hover:scale-[1.02]" />
                )}
                {isVideo(item.path) && (
                  <video src={item.url} className="h-full w-full object-cover align-top transition-transform duration-200 group-hover:scale-[1.02]" muted playsInline preload="metadata" />
                )}
                {!isImage(item.path) && !isVideo(item.path) && (
                  <div className="flex aspect-square w-full items-center justify-center bg-slate-100 text-4xl">📎</div>
                )}
              </div>
            </>
          )}
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
                onClick={() => onToggleFavorite(item)}
                disabled={favoritingId === item.id}
                className={`flex h-9 w-9 items-center justify-center rounded-lg shadow hover:opacity-90 disabled:opacity-50 ${isFav ? 'bg-rose-500/90 text-white' : 'bg-slate-900/70 text-white hover:bg-slate-800/80'}`}
                aria-label={isFav ? 'Unfavorite' : 'Favorite'}
              >
                {favoritingId === item.id ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                )}
              </button>
              <button
                type="button"
                onClick={() => onDownload(item)}
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
              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(item)}
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
      </div>
    </div>
  );
});

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
  viewMode,
  onSwitchView,
  sortOption,
  onSortChange,
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
  viewMode?: 'grid' | 'metadata';
  onSwitchView?: () => void;
  sortOption?: SortOption;
  onSortChange?: (sort: SortOption) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-slate-500">
        {lastRefreshedAt ? <>Last refreshed {formatLastRefreshed(lastRefreshedAt)}</> : '—'}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {onSortChange && sortOption !== undefined && (
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            aria-label="Sort by"
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="favorites-first">Favorites first</option>
            <option value="type-desc">Photos first</option>
            <option value="type-asc">Videos first</option>
            <option value="user-asc">User A–Z</option>
            <option value="user-desc">User Z–A</option>
          </select>
        )}
        {onSwitchView && (
          <button
            type="button"
            onClick={onSwitchView}
            className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${viewMode === 'metadata' ? 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
            aria-pressed={viewMode === 'metadata'}
            aria-label={viewMode === 'metadata' ? 'Switch to grid view' : 'Switch to metadata view'}
          >
            {viewMode === 'metadata' ? 'Grid view' : 'Metadata view'}
          </button>
        )}
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
  const [rawList, setRawList] = useState<MediaItem[]>([]);
  const [urlMap, setUrlMap] = useState<Record<string, string>>({});
  const [displayedCount, setDisplayedCount] = useState(INITIAL_DISPLAY_COUNT);
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [loading, setLoading] = useState(true);
  const [loadingMoreUrls, setLoadingMoreUrls] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [refreshButtonLabel, setRefreshButtonLabel] = useState('Refresh');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [favoritingId, setFavoritingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingMultiple, setDownloadingMultiple] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'metadata'>('grid');
  const [, setTick] = useState(0);

  const sortedList = sortMediaItems(rawList, sortOption);
  const displayedItems: MediaItem[] = sortedList.slice(0, displayedCount).map((meta) => ({
    ...meta,
    url: urlMap[meta.id],
  }));

  const switchView = useCallback(() => {
    setLightboxItem(null);
    setViewMode((v) => (v === 'grid' ? 'metadata' : 'grid'));
  }, []);

  const canDelete = (item: MediaItem): boolean =>
    Boolean(userId && activeTrip && (item.uploadedBy === userId || activeTrip.allowAnyMemberToDelete));

  const invalidateListCache = useCallback(() => {
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(`${LIST_CACHE_KEY_PREFIX}${activeTripId}`);
      } catch {
        // ignore
      }
    }
  }, [activeTripId]);

  const handleDelete = useCallback(
    async (item: MediaItem) => {
      if (!window.confirm('Delete this photo/video? This cannot be undone.')) return;
      setDeletingId(item.id);
      setError(null);
      try {
        if (item.uploadedBy === userId) {
          await dataClient.models.Media.delete({ id: item.id });
          setRawList((prev) => prev.filter((i) => i.id !== item.id));
          setUrlMap((prev) => {
            const next = { ...prev };
            delete next[item.id];
            return next;
          });
          if (lightboxItem?.id === item.id) setLightboxItem(null);
          invalidateListCache();
        } else {
          const { data, errors } = await dataClient.mutations.deleteTripMedia({ mediaId: item.id });
          if (errors?.length) {
            setError(errors.map((e) => e.message).join(' ') || 'Failed to delete');
            return;
          }
          if (data?.success) {
            setRawList((prev) => prev.filter((i) => i.id !== item.id));
            setUrlMap((prev) => {
              const next = { ...prev };
              delete next[item.id];
              return next;
            });
            if (lightboxItem?.id === item.id) setLightboxItem(null);
            invalidateListCache();
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
    [userId, lightboxItem?.id, invalidateListCache]
  );

  useEffect(() => {
    if (!lastRefreshedAt) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [lastRefreshedAt]);

  const loadRawList = useCallback(
    async (bypassCache = false) => {
      setLoading(true);
      setError(null);
      const cacheKey = `${LIST_CACHE_KEY_PREFIX}${activeTripId}`;
      if (!bypassCache && typeof sessionStorage !== 'undefined') {
        try {
          const raw = sessionStorage.getItem(cacheKey);
          if (raw) {
            const { at, list } = JSON.parse(raw) as { at: number; list: MediaItem[] };
            if (Date.now() - at < LIST_CACHE_TTL_MS && Array.isArray(list)) {
              setRawList(list);
              setUrlMap({});
              setDisplayedCount(INITIAL_DISPLAY_COUNT);
              setLastRefreshedAt(new Date(at));
              setLoading(false);
              return;
            }
          }
        } catch {
          // ignore cache parse errors
        }
      }
      try {
        const { data: mediaList } = await dataClient.models.Media.list({
          filter: { tripId: { eq: activeTripId } },
        });
        const list = (mediaList ?? []).map((m) => ({
          id: m.id,
          path: m.storagePath,
          uploadedBy: m.uploadedBy,
          uploadedByUsername: m.uploadedByUsername ?? null,
          lat: m.lat ?? null,
          lng: m.lng ?? null,
          timestamp: m.timestamp ?? null,
          isFavorite: m.isFavorite ?? null,
          locationName: m.locationName ?? null,
          rating: m.rating ?? null,
          review: m.review ?? null,
          visited: m.visited ?? null,
        }));
        setRawList(list);
        setUrlMap({});
        setDisplayedCount(INITIAL_DISPLAY_COUNT);
        setLastRefreshedAt(new Date());
        if (typeof sessionStorage !== 'undefined') {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), list }));
          } catch {
            // ignore
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to load gallery';
        setError(
          message +
            (typeof window !== 'undefined' &&
            window.location.hostname !== 'localhost'
              ? ' (check auth and that the deployed backend is up to date)'
              : '')
        );
        setRawList([]);
      } finally {
        setLoading(false);
      }
    },
    [activeTripId]
  );

  useEffect(() => {
    loadRawList(refreshTrigger > 0);
  }, [loadRawList, refreshTrigger]);

  // Fetch signed URLs in small batches to avoid overload and reduce failed loads
  const BATCH_SIZE = 5;
  useEffect(() => {
    const sorted = sortMediaItems(rawList, sortOption);
    const idsToLoad = sorted
      .slice(0, displayedCount)
      .map((m) => m.id)
      .filter((id) => !urlMap[id])
      .filter((id) => {
        const m = rawList.find((x) => x.id === id);
        return m && !isHeic(m.path);
      });
    if (idsToLoad.length === 0) {
      setLoadingMoreUrls(false);
      return;
    }
    setLoadingMoreUrls(true);
    let cancelled = false;
    (async () => {
      for (let i = 0; i < idsToLoad.length && !cancelled; i += BATCH_SIZE) {
        const batch = idsToLoad.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(
          batch.map(async (id) => {
            const m = rawList.find((x) => x.id === id);
            if (!m) return null;
            try {
              const { url } = await getUrl({ path: m.path, options: { expiresIn: URL_EXPIRES_IN } });
              return { id, url: url.toString() };
            } catch {
              return null;
            }
          })
        );
        if (cancelled) return;
        setUrlMap((prev) => {
          const next = { ...prev };
          results.forEach((r) => {
            if (r) next[r.id] = r.url;
          });
          return next;
        });
      }
      if (!cancelled) setLoadingMoreUrls(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [rawList, sortOption, displayedCount]); // urlMap omitted to avoid loop

  const handleRefresh = useCallback(() => {
    setRefreshButtonLabel('Refreshing…');
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.removeItem(`${LIST_CACHE_KEY_PREFIX}${activeTripId}`);
      } catch {
        // ignore
      }
    }
    loadRawList(true).finally(() => setRefreshButtonLabel('Refresh'));
  }, [loadRawList, activeTripId]);

  const loadMore = useCallback(() => {
    setDisplayedCount((n) => Math.min(n + LOAD_MORE_COUNT, rawList.length));
  }, [rawList.length]);

  const openLightbox = useCallback((item: MediaItem) => setLightboxItem(item), []);
  const closeLightbox = useCallback(() => setLightboxItem(null), []);

  const handleToggleFavorite = useCallback(
    async (item: MediaItem) => {
      setFavoritingId(item.id);
      setError(null);
      const next = !item.isFavorite;
      try {
        await dataClient.models.Media.update({
          id: item.id,
          isFavorite: next,
        });
        setRawList((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, isFavorite: next } : i))
        );
        setLightboxItem((prev) =>
          prev?.id === item.id ? { ...prev, isFavorite: next } : prev
        );
        invalidateListCache();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update favorite');
      } finally {
        setFavoritingId(null);
      }
    },
    [invalidateListCache]
  );

  const handleDownload = useCallback(async (item: MediaItem) => {
    setDownloadingId(item.id);
    try {
      let url = item.url;
      if (!url) {
        const { url: signedUrl } = await getUrl({
          path: item.path,
          options: { expiresIn: URL_EXPIRES_IN },
        });
        url = signedUrl.toString();
      }
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = downloadFilename(item);
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch {
      if (item.url) window.open(item.url, '_blank', 'noopener,noreferrer');
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
    setSelectedIds(new Set(displayedItems.map((i) => i.id)));
  }, [displayedItems]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleDownloadSelected = useCallback(async () => {
    const toDownload = displayedItems.filter((i) => selectedIds.has(i.id) && i.url);
    if (toDownload.length === 0) return;
    setDownloadingMultiple(true);
    for (let i = 0; i < toDownload.length; i++) {
      await handleDownload(toDownload[i]);
      if (i < toDownload.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
    setSelectedIds(new Set());
    setDownloadingMultiple(false);
  }, [displayedItems, selectedIds, handleDownload]);

  if (loading && rawList.length === 0) {
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

  if (rawList.length === 0) {
    return (
      <div className="space-y-6">
        <GalleryToolbar
          lastRefreshedAt={lastRefreshedAt}
          onRefresh={handleRefresh}
          refreshLabel={refreshButtonLabel}
          loading={loading}
          viewMode={viewMode}
          onSwitchView={switchView}
          sortOption={sortOption}
          onSortChange={setSortOption}
        />
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl">📷</div>
          <p className="text-lg font-semibold text-slate-900">No photos or videos yet</p>
          <p className="text-slate-600">Add your first from the Upload page.</p>
        </div>
      </div>
    );
  }

  const metadataTable = (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="sticky left-0 z-10 w-14 bg-slate-50 px-2 py-3 font-semibold text-slate-700 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">Preview</th>
            <th className="px-4 py-3 font-semibold text-slate-700">File</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Uploaded by</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Favorite</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Lat</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Lng</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Timestamp</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Location</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Rating</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Metadata</th>
            <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedList.map((item) => {
            const filename = item.path.split('/').pop() ?? item.path;
            const hasLocation = item.lat != null && item.lng != null;
            const hasTimestamp = item.timestamp != null && item.timestamp !== '';
            const hasAny = hasLocation || hasTimestamp;
            const itemCanDelete = canDelete(item);
            return (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="sticky left-0 z-10 w-14 bg-white px-2 py-2 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                  <MetadataThumb path={item.path} />
                </td>
                <td className="px-4 py-3 font-mono text-slate-800">{filename}</td>
                <td className="px-4 py-3 text-slate-600">{item.uploadedByUsername ?? '—'}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => handleToggleFavorite(item)}
                    disabled={favoritingId === item.id}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-50 ${item.isFavorite ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600'}`}
                    aria-label={item.isFavorite ? 'Unfavorite' : 'Favorite'}
                  >
                    {favoritingId === item.id ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-rose-400 border-t-transparent" />
                    ) : (
                      <svg className="h-4 w-4" fill={item.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                    )}
                  </button>
                </td>
                <td className="px-4 py-3 font-mono text-slate-600">{item.lat != null ? item.lat.toFixed(5) : '—'}</td>
                <td className="px-4 py-3 font-mono text-slate-600">{item.lng != null ? item.lng.toFixed(5) : '—'}</td>
                <td className="px-4 py-3 text-slate-600">{item.timestamp ?? '—'}</td>
                <td className="px-4 py-3 max-w-[140px] truncate text-slate-600" title={item.locationName ?? undefined}>{item.locationName ?? '—'}</td>
                <td className="px-4 py-3 text-slate-600">{item.rating != null && item.rating >= 1 && item.rating <= 5 ? `${'★'.repeat(item.rating)}` : '—'}</td>
                <td className="px-4 py-3">
                  {hasAny ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
                      ✓ {hasLocation && hasTimestamp ? 'Location + date' : hasLocation ? 'Location' : 'Date'}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">Missing</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      disabled={downloadingId === item.id}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      aria-label="Download"
                    >
                      {downloadingId === item.id ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                      ) : (
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      )}
                    </button>
                    {itemCanDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        disabled={deletingId === item.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                        aria-label="Delete"
                      >
                        {deletingId === item.id ? (
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                        ) : (
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        )}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <GalleryToolbar
        lastRefreshedAt={lastRefreshedAt}
        onRefresh={handleRefresh}
        refreshLabel={refreshButtonLabel}
        loading={loading}
        viewMode={viewMode}
        onSwitchView={switchView}
        sortOption={sortOption}
        onSortChange={setSortOption}
        selectMode={viewMode === 'grid' ? selectMode : undefined}
        onToggleSelectMode={viewMode === 'grid' ? toggleSelectMode : undefined}
        selectedCount={viewMode === 'grid' ? selectedIds.size : undefined}
        onSelectAll={viewMode === 'grid' ? selectAll : undefined}
        onClearSelection={viewMode === 'grid' ? clearSelection : undefined}
        onDownloadSelected={viewMode === 'grid' ? handleDownloadSelected : undefined}
        downloadingMultiple={viewMode === 'grid' ? downloadingMultiple : undefined}
      />
      {viewMode === 'metadata' ? (
        <div className="pb-24 pt-2">{metadataTable}</div>
      ) : (
        <>
          <div className="columns-2 gap-5 pb-6 pt-2 md:columns-3 lg:columns-4 lg:gap-6">
            {displayedItems.map((item) => (
              <GalleryCard
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                selectMode={selectMode}
                downloadingId={downloadingId}
                deletingId={deletingId}
                favoritingId={favoritingId}
                canDelete={canDelete(item)}
                onCardClick={openLightbox}
                onToggleSelection={toggleSelection}
                onDownload={handleDownload}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
          {displayedCount < rawList.length && (
            <div className="flex justify-center pb-24 pt-4">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMoreUrls}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
              >
                {loadingMoreUrls ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                    Loading…
                  </>
                ) : (
                  `Load more (${rawList.length - displayedCount} remaining)`
                )}
              </button>
            </div>
          )}
          {displayedCount >= rawList.length && rawList.length > 0 && <div className="pb-24" />}
        </>
      )}
      {lightboxItem?.url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm" onClick={closeLightbox}>
          <div className="relative flex max-h-full max-w-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {isImage(lightboxItem.path) && <img src={lightboxItem.url} alt="" className="max-h-[90vh] w-auto max-w-full rounded-xl object-contain shadow-2xl" />}
            {isVideo(lightboxItem.path) && <video src={lightboxItem.url} controls autoPlay className="max-h-[90vh] max-w-full rounded-xl shadow-2xl" />}
            <div className="absolute -bottom-12 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => handleToggleFavorite(lightboxItem)}
                disabled={favoritingId === lightboxItem.id}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${lightboxItem.isFavorite ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-slate-700 text-white hover:bg-slate-600'}`}
                aria-label={lightboxItem.isFavorite ? 'Unfavorite' : 'Favorite'}
              >
                {favoritingId === lightboxItem.id ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <svg className="h-5 w-5" fill={lightboxItem.isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                )}
                {lightboxItem.isFavorite ? 'Favorited' : 'Favorite'}
              </button>
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
