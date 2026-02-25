'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

/** Admin can see and switch to all trips without joining; they do not appear in trip members until they join. */
const ADMIN_EMAIL = 'matthewljk@gmail.com';

export type TripWithRole = {
  id: string;
  tripCode: string;
  name: string | null;
  role: string;
  /** True if user joined via code (has TripMember); false if admin viewing without joining */
  isActualMember: boolean;
  allowAnyMemberToDelete: boolean;
  startDate: string | null;
  endDate: string | null;
  baseCurrency: string | null;
  budgetPerPax: number | null;
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
      const attrs = (await fetchUserAttributes().catch(() => ({}))) as Record<string, string>;
      const email = (attrs.email ?? attrs['custom:email'] ?? '').trim().toLowerCase();
      const isAdmin = email === ADMIN_EMAIL;

      const [membersRes, prefsRes] = await Promise.all([
        client.models.TripMember.list({ filter: { userId: { eq: uid } } }),
        client.models.UserPreference.list(),
      ]);
      const members = membersRes.data ?? [];
      const pref = prefsRes.data[0];
      const preferredId = pref?.activeTripId ?? null;
      const memberTripIds = [...new Set(members.map((m) => m.tripId))];

      let withRole: TripWithRole[];
      let allTripIds: string[];

      if (memberTripIds.length > 0) {
        const tripRecords = await Promise.all(
          memberTripIds.map((id) => client.models.Trip.get({ id }))
        );
        const tripMap = new Map(
          tripRecords
            .filter((r) => r.data)
            .map((r) => [r.data!.id, r.data!])
        );
        withRole = members
          .map((m) => {
            const trip = tripMap.get(m.tripId);
            return trip
              ? {
                  id: trip.id,
                  tripCode: trip.tripCode,
                  name: trip.name ?? null,
                  role: m.role,
                  isActualMember: true,
                  allowAnyMemberToDelete: trip.allowAnyMemberToDelete === true,
                  startDate: trip.startDate ?? null,
                  endDate: trip.endDate ?? null,
                  baseCurrency: trip.baseCurrency ?? null,
                  budgetPerPax: trip.budgetPerPax ?? null,
                }
              : null;
          })
          .filter(Boolean) as TripWithRole[];
        allTripIds = withRole.map((t) => t.id);

        if (isAdmin) {
          const { data: allTrips } = await client.models.Trip.list({});
          const memberIdSet = new Set(memberTripIds);
          const extra = (allTrips ?? [])
            .filter((t) => !memberIdSet.has(t.id))
            .map((t) => ({
              id: t.id,
              tripCode: t.tripCode,
              name: t.name ?? null,
              role: 'member' as const,
              isActualMember: false,
              allowAnyMemberToDelete: t.allowAnyMemberToDelete === true,
              startDate: t.startDate ?? null,
              endDate: t.endDate ?? null,
              baseCurrency: t.baseCurrency ?? null,
              budgetPerPax: t.budgetPerPax ?? null,
            }));
          withRole = [...withRole, ...extra];
          allTripIds = withRole.map((t) => t.id);
        }
      } else if (isAdmin) {
        const { data: allTrips } = await client.models.Trip.list({});
        withRole = (allTrips ?? []).map((t) => ({
          id: t.id,
          tripCode: t.tripCode,
          name: t.name ?? null,
          role: 'member' as const,
          isActualMember: false,
          allowAnyMemberToDelete: t.allowAnyMemberToDelete === true,
          startDate: t.startDate ?? null,
          endDate: t.endDate ?? null,
          baseCurrency: t.baseCurrency ?? null,
          budgetPerPax: t.budgetPerPax ?? null,
        }));
        allTripIds = withRole.map((t) => t.id);
      } else {
        withRole = [];
        allTripIds = [];
      }

      setTrips(withRole);
      const validPreferred =
        preferredId && allTripIds.includes(preferredId) ? preferredId : null;
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

      if (withRole.length === 0) {
        setActiveTripIdState(null);
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

  const leaveTrip = useCallback(
    async (tripId: string) => {
      if (!userId) return;
      const myMembership = (await client.models.TripMember.list({
        filter: { tripId: { eq: tripId }, userId: { eq: userId } },
      })).data?.[0];
      if (!myMembership) return; // not a member (e.g. admin viewing only)
      await client.models.TripMember.delete({ id: myMembership.id });
      const { data: remaining } = await client.models.TripMember.list({
        filter: { tripId: { eq: tripId } },
      });
      if (!remaining?.length) {
        try {
          const result = await client.mutations.cleanupEmptyTrip({ tripId });
          if (result.data?.success !== true) {
            console.warn('cleanupEmptyTrip:', result.data?.message ?? result.errors);
          }
        } catch (e) {
          console.warn('cleanupEmptyTrip failed', e);
        }
      }
      const otherTrip = trips.find((t) => t.id !== tripId && t.isActualMember) ?? trips.find((t) => t.id !== tripId);
      const newActiveId = otherTrip?.id ?? null;
      setActiveTripIdState(newActiveId);
      try {
        const { data } = await client.models.UserPreference.list();
        const pref = data[0];
        if (pref) {
          await client.models.UserPreference.update({ id: pref.id, activeTripId: newActiveId });
        } else if (newActiveId) {
          await client.models.UserPreference.create({ activeTripId: newActiveId });
        }
      } catch {
        // ignore
      }
      await load();
    },
    [userId, trips, load]
  );

  const activeTrip = trips.find((t) => t.id === activeTripId) ?? null;
  const hasTrip = trips.length > 0;

  return {
    userId,
    trips,
    activeTripId,
    activeTrip,
    setActiveTripId,
    leaveTrip,
    hasTrip,
    loading,
    refresh: load,
  };
}
