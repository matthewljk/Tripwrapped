'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { buildWrapRecap, type WrapRecapData } from '@/lib/wrapRecap';

const dataClient = generateClient<Schema>();

export function useWrapRecapData(activeTripId: string | null) {
  const [data, setData] = useState<WrapRecapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeTripId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [tripRes, mediaRes, txRes] = await Promise.all([
        dataClient.models.Trip.get({ id: activeTripId }),
        dataClient.models.Media.list({ filter: { tripId: { eq: activeTripId } } }),
        dataClient.models.Transaction.list({ filter: { tripId: { eq: activeTripId } } }),
      ]);
      const trip = tripRes.data ?? null;
      const media = (mediaRes.data ?? []) as Schema['Media']['type'][];
      const transactions = (txRes.data ?? []) as Schema['Transaction']['type'][];
      const baseCurrency = (trip?.baseCurrency?.trim() || 'USD') as string;
      const recap = buildWrapRecap(trip, media, transactions, baseCurrency);
      setData(recap);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recap');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [activeTripId]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: load };
}
