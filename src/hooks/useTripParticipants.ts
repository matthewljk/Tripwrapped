'use client';

import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export type TripParticipant = {
  userId: string;
  username: string | null;
};

export function useTripParticipants(tripId: string | null) {
  const [participants, setParticipants] = useState<TripParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!tripId) {
      setParticipants([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: members } = await client.models.TripMember.list({
        filter: { tripId: { eq: tripId } },
      });
      const userIds = [...new Set((members ?? []).map((m) => m.userId))];
      if (userIds.length === 0) {
        setParticipants([]);
        setLoading(false);
        return;
      }
      const profiles = await Promise.all(
        userIds.map((uid) =>
          client.models.UserProfile.list({ filter: { userId: { eq: uid } } })
        )
      );
      const list: TripParticipant[] = userIds.map((uid, i) => {
        const profile = profiles[i]?.data?.[0];
        return {
          userId: uid,
          username: profile?.username ?? null,
        };
      });
      setParticipants(list);
    } catch {
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    load();
  }, [load]);

  return { participants, loading, refresh: load };
}
