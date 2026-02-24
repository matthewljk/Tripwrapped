'use client';

import 'mapbox-gl/dist/mapbox-gl.css';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import Map from 'react-map-gl/mapbox';
import type mapboxgl from 'mapbox-gl';
import { getUrl } from 'aws-amplify/storage';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const dataClient = generateClient<Schema>();
const MAP_STYLE = 'mapbox://styles/mapbox/standard';
const URL_EXPIRES_IN = 3600;
const PATH_COLOR = '#FFB300';
const DEFAULT_CENTER: [number, number] = [0, 20];

export type TripMediaRecord = {
  id: string;
  storagePath: string;
  lat: number;
  lng: number;
  timestamp: string | null;
  uploadedByUsername: string | null;
};

type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';

function getLightPresetForLocalTime(): LightPreset {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

function getLightPresetForTimestamp(isoTimestamp: string | null): LightPreset {
  if (!isoTimestamp) return getLightPresetForLocalTime();
  const hour = new Date(isoTimestamp).getHours();
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

export type TripMapRef = {
  startTour: () => Promise<void>;
};

type TripMapProps = {
  activeTripId: string;
  mapboxAccessToken: string;
  mapRef?: React.Ref<TripMapRef | null>;
};

export default function TripMap({
  activeTripId,
  mapboxAccessToken,
  mapRef,
}: TripMapProps) {
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [mediaWithLocation, setMediaWithLocation] = useState<TripMediaRecord[]>(
    []
  );
  const [mapReady, setMapReady] = useState(false);
  const [tourRunning, setTourRunning] = useState(false);

  // Load media with lat/lng (filter out nulls)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: list } = await dataClient.models.Media.list({
        filter: { tripId: { eq: activeTripId } },
      });
      if (cancelled) return;
      const withLocation: TripMediaRecord[] = (list ?? [])
        .filter(
          (m): m is typeof m & { lat: number; lng: number } =>
            m.lat != null && m.lng != null
        )
        .map((m) => ({
          id: m.id,
          storagePath: m.storagePath,
          lat: m.lat!,
          lng: m.lng!,
          timestamp: m.timestamp ?? null,
          uploadedByUsername: m.uploadedByUsername ?? null,
        }));
      setMediaWithLocation(withLocation);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTripId]);

  const sortedByTime = [...mediaWithLocation].sort((a, b) => {
    const tA = a.timestamp ?? '';
    const tB = b.timestamp ?? '';
    return tA.localeCompare(tB);
  });

  const startTour = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map || sortedByTime.length === 0) return;
    setTourRunning(true);
    try {
      for (let i = 0; i < sortedByTime.length; i++) {
        const photo = sortedByTime[i];
        const preset = getLightPresetForTimestamp(photo.timestamp);
        try {
          map.setConfigProperty('basemap', 'lightPreset', preset);
        } catch {
          // ignore if Standard style not active
        }
        await new Promise<void>((resolve, reject) => {
          map.flyTo({
            center: [photo.lng, photo.lat],
            zoom: 15,
            pitch: 60,
            duration: 3000,
            essential: true,
          });
          map.once('moveend', () => resolve());
          setTimeout(() => resolve(), 3200);
        });
      }
    } finally {
      setTourRunning(false);
    }
  }, [sortedByTime]);

  useImperativeHandle(
    mapRef,
    () => ({
      startTour,
    }),
    [startTour]
  );

  const handleMapLoad = useCallback(
    async (evt: { target: mapboxgl.Map }) => {
      const map = evt.target;
      mapInstanceRef.current = map;

      const mapboxgl = (await import('mapbox-gl')).default;
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');

      // 1) Dynamic lighting from local time
      const preset = getLightPresetForLocalTime();
      try {
        map.setConfigProperty('basemap', 'lightPreset', preset);
      } catch {
        // Standard style may not support it
      }

      // 2) 3D Terrain (mapbox-dem)
      try {
        if (!map.getSource('mapbox-dem')) {
          map.addSource('mapbox-dem', {
            type: 'raster-dem',
            url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
            tileSize: 512,
            maxzoom: 14,
          });
        }
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1 });
      } catch {
        // terrain may already exist or style differs
      }

      setMapReady(true);
    },
    []
  );

  // Path layer + markers (when map ready and media loaded)
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;

    // Travel path: GeoJSON LineString from sorted-by-timestamp points
    const pathId = 'trip-travel-path';
    const pathSourceId = 'trip-travel-path-source';

    if (sortedByTime.length >= 2) {
      const coordinates = sortedByTime.map((p) => [p.lng, p.lat] as [number, number]);
      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      };

      try {
        if (map.getSource(pathSourceId)) {
          (map.getSource(pathSourceId) as mapboxgl.GeoJSONSource).setData(
            geojson
          );
        } else {
          map.addSource(pathSourceId, {
            type: 'geojson',
            data: geojson,
          });
        }
        if (!map.getLayer(pathId)) {
          map.addLayer({
            id: pathId,
            type: 'line',
            source: pathSourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': PATH_COLOR,
              'line-width': 4,
              'line-blur': 0.5,
            },
          });
        }
      } catch (e) {
        // style might not be loaded yet
      }

      if (sortedByTime.length >= 2) {
        const lngs = sortedByTime.map((p) => p.lng);
        const lats = sortedByTime.map((p) => p.lat);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 60, maxZoom: 14, duration: 800 }
        );
      } else if (sortedByTime.length === 1) {
        map.flyTo({
          center: [sortedByTime[0].lng, sortedByTime[0].lat],
          zoom: 12,
          duration: 600,
        });
      }
    } else {
      try {
        if (map.getLayer(pathId)) map.removeLayer(pathId);
        if (map.getSource(pathSourceId)) map.removeSource(pathSourceId);
      } catch {
        // ignore
      }
    }

    // Markers: custom HTML with S3 image
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const addMarkers = async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      for (const record of sortedByTime) {
        let imageUrl: string | null = null;
        try {
          const { url } = await getUrl({
            path: record.storagePath,
            options: { expiresIn: URL_EXPIRES_IN },
          });
          imageUrl = url.toString();
        } catch {
          // use placeholder
        }

        const el = document.createElement('div');
        el.className = 'trip-map-marker';
        el.dataset.markerId = record.id;
        el.style.cssText = `
          width: 45px;
          height: 45px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.35);
          overflow: hidden;
          cursor: pointer;
          position: relative;
          transition: transform 0.25s ease-out;
          background: #374151;
        `;
        if (imageUrl) {
          const img = document.createElement('img');
          img.src = imageUrl;
          img.alt = '';
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
          el.appendChild(img);
        } else {
          el.innerHTML = '<span style="color:#9ca3af;font-size:18px;display:flex;align-items:center;justify-content:center;height:100%;">?</span>';
        }
        const pointer = document.createElement('div');
        pointer.style.cssText = `
          position: absolute;
          bottom: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 8px solid white;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        `;
        el.appendChild(pointer);

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat([record.lng, record.lat])
          .addTo(map);
        markersRef.current.push(marker);
      }
    };

    addMarkers();

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [mapReady, sortedByTime]);

  // Pop animation when map center is near a marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || sortedByTime.length === 0) return;

    const onMoveEnd = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const markers = document.querySelectorAll('.trip-map-marker');
      markers.forEach((el) => {
        const markerId = el.getAttribute('data-marker-id');
        const record = sortedByTime.find((r) => r.id === markerId);
        if (!record) return;
        const point = map.project([record.lng, record.lat]);
        const c = map.project([center.lng, center.lat]);
        const dist = Math.hypot(point.x - c.x, point.y - c.y);
        const scale = zoom >= 14 && dist < 120 ? 1.15 : 1;
        (el as HTMLElement).style.transform = `scale(${scale})`;
      });
    };

    map.on('moveend', onMoveEnd);
    onMoveEnd();
    return () => {
      map.off('moveend', onMoveEnd);
    };
  }, [mapReady, sortedByTime]);

  const initialCenter =
    sortedByTime.length > 0
      ? [sortedByTime[0].lng, sortedByTime[0].lat] as [number, number]
      : DEFAULT_CENTER;

  if (!mapboxAccessToken) return null;

  return (
    <div className="relative h-full w-full">
      <Map
        mapboxAccessToken={mapboxAccessToken}
        initialViewState={{
          longitude: initialCenter[0],
          latitude: initialCenter[1],
          zoom: 12,
          pitch: 45,
          bearing: 0,
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={MAP_STYLE}
        onLoad={handleMapLoad}
      />
      {sortedByTime.length > 0 && (
        <button
          type="button"
          onClick={startTour}
          disabled={tourRunning}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-amber-600 disabled:opacity-60"
        >
          {tourRunning ? 'Tour…' : 'Start tour'}
        </button>
      )}
      {mediaWithLocation.length === 0 && mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <p className="rounded-xl bg-slate-800/90 px-4 py-3 text-sm text-slate-200">
            No photos or videos with location data in this trip.
          </p>
        </div>
      )}
    </div>
  );
}
