'use client';

import { useEffect, useState } from 'react';
import { getUrl } from 'aws-amplify/storage';
import type { WrapRecapData } from '@/lib/wrapRecap';

const URL_EXPIRES_IN = 3600;

function Thumb({ storagePath, isVideo }: { storagePath: string; isVideo: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let c = false;
    getUrl({ path: storagePath, options: { expiresIn: URL_EXPIRES_IN } })
      .then((r) => { if (!c) setUrl(r.url.toString()); })
      .catch(() => {});
    return () => { c = true; };
  }, [storagePath]);
  return (
    <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-200">
      {url ? (
        isVideo ? (
          <video src={url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
        ) : (
          <img src={url} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-400">{isVideo ? '🎬' : '🖼'}</div>
      )}
    </div>
  );
}

type Props = {
  recapData: WrapRecapData;
  excludedIds: Set<string>;
  onToggle: (id: string) => void;
};

export default function WrapRecapMediaSelector({ recapData, excludedIds, onToggle }: Props) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-semibold text-slate-900">Choose media for your video</h3>
      <p className="mt-1 text-sm text-slate-600">
        Uncheck any photo or video to exclude it from the recap video.
      </p>
      <div className="mt-4 space-y-6">
        {recapData.days.map((day) => (
          <div key={day.dateKey}>
            <h4 className="mb-2 text-sm font-medium text-slate-700">{day.dateLabel}</h4>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {day.highlights.map((m) => (
                <label
                  key={m.id}
                  className={`relative flex cursor-pointer flex-col overflow-hidden rounded-xl border-2 transition-colors ${
                    excludedIds.has(m.id) ? 'border-slate-200 opacity-60' : 'border-blue-400'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!excludedIds.has(m.id)}
                    onChange={() => onToggle(m.id)}
                    className="absolute left-2 top-2 z-10 h-5 w-5 rounded border-slate-300"
                  />
                  <Thumb storagePath={m.storagePath} isVideo={m.isVideo} />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
