'use client';

import { useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useActiveTrip } from '@/hooks/useActiveTrip';

const client = generateClient<Schema>();

export default function TripsPage() {
  const { trips, activeTripId, activeTrip, setActiveTripId, loading, hasTrip, refresh } = useActiveTrip();
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createAllowAnyDelete, setCreateAllowAnyDelete] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = createCode.trim();
    if (!code) {
      setCreateError('Enter a trip code');
      return;
    }
    setCreateError(null);
    setCreateBusy(true);
    setCreateSuccess(false);
    try {
      const { data: existing } = await client.models.Trip.list({ filter: { tripCode: { eq: code } } });
      if (existing && existing.length > 0) {
        setCreateError('That code is already taken.');
        return;
      }
      const { data: trip } = await client.models.Trip.create({
        tripCode: code,
        name: createName.trim() || null,
        allowAnyMemberToDelete: createAllowAnyDelete,
      });
      if (!trip) throw new Error('Create failed');
      const { userId } = await getCurrentUser();
      await client.models.TripMember.create({ tripId: trip.id, userId, role: 'owner' });
      await setActiveTripId(trip.id);
      setCreateCode('');
      setCreateName('');
      setCreateSuccess(true);
      refresh();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create trip');
    } finally {
      setCreateBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code) {
      setJoinError('Enter the trip code');
      return;
    }
    setJoinError(null);
    setJoinBusy(true);
    setJoinSuccess(false);
    try {
      const { data: existing } = await client.models.Trip.list({ filter: { tripCode: { eq: code } } });
      if (!existing || existing.length === 0) {
        setJoinError('No trip found with that code.');
        setJoinBusy(false);
        return;
      }
      const trip = existing[0];
      const { userId } = await getCurrentUser();
      const { data: members } = await client.models.TripMember.list({ filter: { tripId: { eq: trip.id } } });
      if (members?.some((m) => m.userId === userId)) {
        setJoinError('You are already in this trip.');
        setJoinBusy(false);
        return;
      }
      await client.models.TripMember.create({ tripId: trip.id, userId, role: 'member' });
      await setActiveTripId(trip.id);
      setJoinCode('');
      setJoinSuccess(true);
      refresh();
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Could not join trip');
    } finally {
      setJoinBusy(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-28 pt-20 sm:pb-24 sm:pt-24 sm:px-6 safe-area-padding">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Trips</h1>
      <p className="mt-2 text-slate-600">Join a trip with a code or create your own.</p>
      {hasTrip && (
        <section className="card mt-10 p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Active trip</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{activeTrip ? activeTrip.name || activeTrip.tripCode : '—'}</p>
          {activeTrip && (
            <p className="mt-2 text-slate-600">Share code: <span className="font-mono font-semibold text-slate-900">{activeTrip.tripCode}</span></p>
          )}
          {trips.length > 1 && (
            <div className="mt-6">
              <label htmlFor="trip-select" className="sr-only">Switch trip</label>
              <select
                id="trip-select"
                value={activeTripId ?? ''}
                onChange={(e) => setActiveTripId(e.target.value || null)}
                className="w-full max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>{t.name || t.tripCode} · {t.tripCode}</option>
                ))}
              </select>
            </div>
          )}
          {activeTrip && activeTrip.role === 'owner' && (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <p className="text-sm font-semibold text-slate-700">Trip settings</p>
              <label className="mt-3 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={activeTrip.allowAnyMemberToDelete}
                  disabled={settingsBusy}
                  onChange={async (e) => {
                    const next = e.target.checked;
                    setSettingsBusy(true);
                    try {
                      await client.models.Trip.update({
                        id: activeTrip.id,
                        allowAnyMemberToDelete: next,
                      });
                      refresh();
                    } finally {
                      setSettingsBusy(false);
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span className="text-sm text-slate-700">Any trip member can delete photos/videos</span>
              </label>
              <p className="mt-1 text-xs text-slate-500">If off, only the person who uploaded an item can delete it.</p>
            </div>
          )}
        </section>
      )}
      <section className="card mt-10 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-slate-900">Join a trip</h2>
        <p className="mt-2 text-slate-600">Enter the code someone shared with you.</p>
        <form onSubmit={handleJoin} className="mt-6 space-y-5">
          <div>
            <label htmlFor="join-code" className="block text-sm font-semibold text-slate-700">Trip code</label>
            <input id="join-code" type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="e.g. BALI2026" className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" disabled={joinBusy} />
          </div>
          {joinError && <p className="text-sm font-medium text-red-600">{joinError}</p>}
          {joinSuccess && <p className="text-sm font-medium text-slate-600">You joined the trip.</p>}
          <button type="submit" disabled={joinBusy} className="btn-primary">{joinBusy ? 'Joining…' : 'Join trip'}</button>
        </form>
      </section>
      <section className="card mt-10 p-6 sm:p-8">
        <h2 className="text-xl font-bold text-slate-900">Create a trip</h2>
        <p className="mt-2 text-slate-600">Pick a unique code others will use to join.</p>
        <form onSubmit={handleCreate} className="mt-6 space-y-5">
          <div>
            <label htmlFor="create-code" className="block text-sm font-semibold text-slate-700">Trip code</label>
            <input id="create-code" type="text" value={createCode} onChange={(e) => setCreateCode(e.target.value)} placeholder="e.g. BALI2026" className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" disabled={createBusy} />
          </div>
          <div>
            <label htmlFor="create-name" className="block text-sm font-semibold text-slate-700">Name <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="create-name" type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Bali holiday" className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" disabled={createBusy} />
          </div>
          <div>
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={createAllowAnyDelete}
                onChange={(e) => setCreateAllowAnyDelete(e.target.checked)}
                disabled={createBusy}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span className="text-sm font-medium text-slate-700">Any trip member can delete photos/videos</span>
            </label>
            <p className="mt-1 text-xs text-slate-500">If unchecked, only the uploader can delete their own items.</p>
          </div>
          {createError && <p className="text-sm font-medium text-red-600">{createError}</p>}
          {createSuccess && <p className="text-sm font-medium text-slate-600">Trip created.</p>}
          <button type="submit" disabled={createBusy} className="btn-primary">{createBusy ? 'Creating…' : 'Create trip'}</button>
        </form>
      </section>
    </div>
  );
}
