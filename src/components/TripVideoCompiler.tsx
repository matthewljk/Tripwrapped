'use client';

import { useCallback, useState } from 'react';
import { getUrl } from 'aws-amplify/storage';
import type { WrapRecapData } from '@/lib/wrapRecap';
import { getVideoTimeline, getLocationNamesForDay } from '@/lib/wrapRecap';

const URL_EXPIRES_IN = 3600;
const STATS_DURATION_MS = 4000;
const DAY_CARD_DURATION_MS = 3500;
const PHOTO_DURATION_MS = 3000;
const VIDEO_MAX_DURATION_MS = 15000;
const FPS = 25;

const LANDSCAPE = { w: 1920, h: 1080 };
const PORTRAIT = { w: 1080, h: 1920 };

function formatTripDates(start: string | null, end: string | null): string {
  if (!start && !end) return '—';
  const s = start ? new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '?';
  const e = end ? new Date(end).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '?';
  return start && end ? `${s} – ${e}` : s;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(amount);
}

type Segment =
  | { type: 'stats' }
  | { type: 'dayCard'; dateLabel: string; locationNames: string[] }
  | { type: 'photo'; img: HTMLImageElement }
  | { type: 'video'; video: HTMLVideoElement; durationMs: number };

function matchesOrientation(isLandscape: boolean, width: number, height: number): boolean {
  if (isLandscape) return width >= height;
  return height > width;
}

type Props = {
  recapData: WrapRecapData;
  onError?: (message: string) => void;
};

export default function TripVideoCompiler({ recapData, onError }: Props) {
  const [orientation, setOrientation] = useState<'landscape' | 'portrait' | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'rendering' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState('');
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const runCompile = useCallback(async () => {
    if (!recapData || !orientation || status === 'loading' || status === 'rendering') return;
    setStatus('loading');
    setProgress('Preparing…');
    setDownloadUrl(null);

    const stats = recapData.stats;
    const isLandscape = orientation === 'landscape';
    const { w: WIDTH, h: HEIGHT } = isLandscape ? LANDSCAPE : PORTRAIT;

    const segments: Segment[] = [{ type: 'stats' }];

    try {
      setProgress('Fetching media…');
      const days = recapData.days;
      if (days.length === 0) {
        setStatus('error');
        onError?.('No days with media');
        return;
      }

      for (let d = 0; d < days.length; d++) {
        const day = days[d];
        setProgress(`Loading day ${d + 1} / ${days.length}…`);
        const daySegments: Segment[] = [];
        for (const m of day.highlights) {
          const url = (await getUrl({ path: m.storagePath, options: { expiresIn: URL_EXPIRES_IN } })).url.toString();
          if (m.isVideo) {
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.crossOrigin = 'anonymous';
            video.preload = 'auto';
            await new Promise<void>((resolve, reject) => {
              video.oncanplay = () => resolve();
              video.onerror = () => reject(new Error('Failed to load video'));
              video.src = url;
            });
            if (matchesOrientation(isLandscape, video.videoWidth, video.videoHeight)) {
              const durSec = Math.min(video.duration, VIDEO_MAX_DURATION_MS / 1000);
              daySegments.push({ type: 'video', video, durationMs: durSec * 1000 });
            } else {
              video.src = '';
            }
          } else {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('Failed to load image'));
              img.src = url;
            });
            if (matchesOrientation(isLandscape, img.naturalWidth, img.naturalHeight)) {
              daySegments.push({ type: 'photo', img });
            }
          }
        }
        if (daySegments.length > 0) {
          const locationNames = getLocationNamesForDay(day.highlights);
          segments.push({ type: 'dayCard', dateLabel: day.dateLabel, locationNames });
          segments.push(...daySegments);
        }
      }

      const mediaCount = segments.filter((s) => s.type === 'photo' || s.type === 'video').length;
      if (mediaCount === 0) {
        setStatus('error');
        onError?.('No media matched the chosen orientation. Try the other orientation.');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setStatus('error');
        onError?.('Canvas not supported');
        return;
      }

      const stream = canvas.captureStream(FPS);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2500000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setDownloadUrl(URL.createObjectURL(blob));
        setStatus('done');
        setProgress('');
      };

      recorder.start(100);
      setStatus('rendering');

      const drawStats = () => {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        const scale = Math.min(WIDTH / 1080, HEIGHT / 1920);
        ctx.font = `bold ${Math.round(56 * scale)}px system-ui, sans-serif`;
        ctx.fillText('TripWrapped', WIDTH / 2, HEIGHT * 0.18);
        ctx.font = `${Math.round(36 * scale)}px system-ui, sans-serif`;
        ctx.fillText(formatTripDates(stats.tripStartDate, stats.tripEndDate), WIDTH / 2, HEIGHT * 0.28);
        ctx.font = `${Math.round(32 * scale)}px system-ui, sans-serif`;
        ctx.fillText(`${stats.totalPhotos} photos · ${stats.totalVideos} videos`, WIDTH / 2, HEIGHT * 0.35);
        ctx.fillText(formatCurrency(stats.totalExpense, stats.baseCurrency), WIDTH / 2, HEIGHT * 0.42);
        if (stats.distanceKm > 0) ctx.fillText(`${stats.distanceKm.toFixed(1)} km`, WIDTH / 2, HEIGHT * 0.49);
      };

      const drawDayCard = (dateLabel: string, locationNames: string[]) => {
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        const scale = Math.min(WIDTH / 1080, HEIGHT / 1920);
        ctx.font = `bold ${Math.round(48 * scale)}px system-ui, sans-serif`;
        ctx.fillText(dateLabel, WIDTH / 2, HEIGHT * 0.35);
        if (locationNames.length > 0) {
          ctx.font = `${Math.round(28 * scale)}px system-ui, sans-serif`;
          const line = locationNames.join(' · ');
          const maxCharsPerLine = isLandscape ? 50 : 28;
          const lines: string[] = [];
          let remaining = line;
          while (remaining.length > 0 && lines.length < 5) {
            if (remaining.length <= maxCharsPerLine) {
              lines.push(remaining);
              break;
            }
            const chunk = remaining.slice(0, maxCharsPerLine);
            const lastSpace = chunk.lastIndexOf(' ');
            const cut = lastSpace > maxCharsPerLine / 2 ? lastSpace : maxCharsPerLine;
            lines.push(remaining.slice(0, cut).trim());
            remaining = remaining.slice(cut).trim();
          }
          const startY = HEIGHT * 0.48;
          const lineHeight = Math.round(38 * scale);
          lines.forEach((l, i) => {
            ctx.fillText(l, WIDTH / 2, startY + i * lineHeight);
          });
        }
      };

      const drawImage = (img: HTMLImageElement) => {
        const scale = Math.max(WIDTH / img.naturalWidth, HEIGHT / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.drawImage(img, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
      };

      const drawVideoFrame = (video: HTMLVideoElement) => {
        if (video.readyState < 2) return;
        const scale = Math.max(WIDTH / video.videoWidth, HEIGHT / video.videoHeight);
        const w = video.videoWidth * scale;
        const h = video.videoHeight * scale;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.drawImage(video, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
      };

      let segmentIndex = 0;
      let segmentStartTime = 0;
      let startTime = performance.now();

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const seg = segments[segmentIndex];

        if (!seg) {
          recorder.stop();
          return;
        }

        setProgress(`Rendering ${segmentIndex + 1} / ${segments.length}…`);

        if (seg.type === 'stats') {
          drawStats();
          if (elapsed >= STATS_DURATION_MS) {
            segmentIndex++;
            segmentStartTime = elapsed;
            const next = segments[segmentIndex];
            if (next?.type === 'video') next.video.currentTime = 0;
            if (next?.type === 'video') next.video.play();
          }
        } else if (seg.type === 'dayCard') {
          drawDayCard(seg.dateLabel, seg.locationNames);
          if (elapsed - segmentStartTime >= DAY_CARD_DURATION_MS) {
            segmentIndex++;
            segmentStartTime = elapsed;
            const next = segments[segmentIndex];
            if (next?.type === 'video') {
              next.video.currentTime = 0;
              next.video.play();
            }
          }
        } else if (seg.type === 'photo') {
          drawImage(seg.img);
          if (elapsed - segmentStartTime >= PHOTO_DURATION_MS) {
            segmentIndex++;
            segmentStartTime = elapsed;
            const next = segments[segmentIndex];
            if (next?.type === 'video') {
              next.video.currentTime = 0;
              next.video.play();
            }
          }
        } else {
          if (seg.video.paused && seg.video.readyState >= 2) seg.video.play();
          drawVideoFrame(seg.video);
          if (elapsed - segmentStartTime >= seg.durationMs || seg.video.ended) {
            seg.video.pause();
            segmentIndex++;
            segmentStartTime = elapsed;
            const next = segments[segmentIndex];
            if (next?.type === 'video') {
              next.video.currentTime = 0;
              next.video.play();
            }
          }
        }

        requestAnimationFrame(tick);
      };

      requestAnimationFrame(tick);
    } catch (err) {
      setStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to create video';
      onError?.(msg);
      setProgress('');
    }
  }, [recapData, orientation, status, onError]);

  const hasMedia = getVideoTimeline(recapData).length > 0;

  if (!hasMedia) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-slate-900">Your trip video</h3>
      <p className="mt-1 text-sm text-slate-600">
        Generate a Spotify-style recap. Choose orientation — only media matching that orientation are included.
      </p>

      {status === 'idle' && (
        <>
          <p className="mt-4 text-sm font-medium text-slate-700">Orientation</p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={() => setOrientation('landscape')}
              className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                orientation === 'landscape'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              Landscape (16∶9)
            </button>
            <button
              type="button"
              onClick={() => setOrientation('portrait')}
              className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                orientation === 'portrait'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              Portrait (9∶16)
            </button>
          </div>
          <button
            type="button"
            onClick={runCompile}
            disabled={!orientation}
            className="btn-primary mt-4 disabled:opacity-50 disabled:pointer-events-none"
          >
            Create my trip video
          </button>
        </>
      )}

      {(status === 'loading' || status === 'rendering') && (
        <div className="mt-4 flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" aria-hidden />
          <p className="text-sm font-medium text-slate-700">{progress}</p>
        </div>
      )}

      {status === 'done' && downloadUrl && (
        <div className="mt-4 space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-black">
            <video
              src={downloadUrl}
              controls
              playsInline
              className="h-auto w-full max-h-[70vh]"
            >
              Your browser does not support the video tag.
            </video>
          </div>
          <a href={downloadUrl} download="tripwrapped-recap.webm" className="btn-primary inline-block">
            Download video
          </a>
        </div>
      )}

      {status === 'error' && (
        <p className="mt-4 text-sm font-medium text-red-600">{progress || 'Something went wrong.'}</p>
      )}
    </div>
  );
}
