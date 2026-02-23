'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

export type TripWithRole = {
  id: string;
  tripCode: string;
  name: string | null;
  role: string;
  allowAnyMemberToDelete: boolean;
};

export function useActiveTrip() {
  const [userId, setUserId] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripWithRole[]>([]);
  const [activeTripId, setActiveTripIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { userId: uid } = await getCurrentUser();
      setUserId(uid);
      const [membersRes, prefsRes] = await Promise.all([
        client.models.TripMember.list({ filter: { userId: { eq: uid } } }),
        client.models.UserPreference.list(),
      ]);
      const members = membersRes.data ?? [];
      const pref = prefsRes.data[0];
      const preferredId = pref?.activeTripId ?? null;
      const tripIds = [...new Set(members.map((m) => m.tripId))];
      if (tripIds.length === 0) {
        setTrips([]);
        setActiveTripIdState(null);
        setLoading(false);
        return;
      }
      const tripRecords = await Promise.all(
        tripIds.map((id) => client.models.Trip.get({ id }))
      );
      const tripMap = new Map(
        tripRecords
          .filter((r) => r.data)
          .map((r) => [r.data!.id, r.data!])
      );
      const withRole: TripWithRole[] = members
        .map((m) => {
          const trip = tripMap.get(m.tripId);
          return trip
            ? {
                id: trip.id,
                tripCode: trip.tripCode,
                name: trip.name ?? null,
                role: m.role,
                allowAnyMemberToDelete: trip.allowAnyMemberToDelete === true,
              }
            : null;
        })
        .filter(Boolean) as TripWithRole[];
      setTrips(withRole);
      const validPreferred =
        preferredId && tripIds.includes(preferredId) ? preferredId : null;
      const fallbackId = validPreferred ?? withRole[0]?.id ?? null;
      setActiveTripIdState(fallbackId);
      if (!validPreferred && fallbackId && !pref) {
        await client.models.UserPreference.create({ activeTripId: fallbackId });
      } else if (!validPreferred && fallbackId && pref) {
        await client.models.UserPreference.update({
          id: pref.id,
          activeTripId: fallbackId,
        });
      }
    } catch {
      setTrips([]);
      setActiveTripIdState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setActiveTripId = useCallback(
    async (tripId: string | null) => {
      if (!userId) return;
      setActiveTripIdState(tripId);
      try {
        const { data } = await client.models.UserPreference.list();
        const pref = data[0];
        if (pref) {
          await client.models.UserPreference.update({
            id: pref.id,
            activeTripId: tripId,
          });
        } else if (tripId) {
          await client.models.UserPreference.create({ activeTripId: tripId });
        }
      } catch {
        load();
      }
    },
    [userId, load]
  );

  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;
  const hasTrip = trips.length > 0;

  return {
    userId,
    trips,
    activeTripId,
    activeTrip,
    setActiveTripId,
    hasTrip,
    loading,
    refresh: load,
  };
}
