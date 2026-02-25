'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { useUserProfile } from '@/hooks/useUserProfile';

const client = generateClient<Schema>();

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AUD', 'JPY', 'CAD', 'CHF', 'THB', 'MYR', 'IDR', 'PHP', 'VND'];

export default function TripsPage() {
  const { trips, activeTripId, activeTrip, setActiveTripId, loading, hasTrip, refresh } = useActiveTrip();
  const { username, suggestedUsername, hasProfile, loading: profileLoading, error: loadError, setUsernameAndSave, profileAvailable } = useUserProfile();
  const [profileValue, setProfileValue] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createBaseCurrency, setCreateBaseCurrency] = useState('USD');
  const [createBudgetPerPax, setCreateBudgetPerPax] = useState('');
  const [createAllowAnyDelete, setCreateAllowAnyDelete] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [settingsBaseCurrency, setSettingsBaseCurrency] = useState('');
  const [settingsStartDate, setSettingsStartDate] = useState('');
  const [settingsBudgetPerPax, setSettingsBudgetPerPax] = useState('');
  const [settingsAllowAnyDelete, setSettingsAllowAnyDelete] = useState(false);

  useEffect(() => {
    setProfileValue(username ?? suggestedUsername ?? '');
  }, [username, suggestedUsername]);

  useEffect(() => {
    if (!activeTrip) return;
    setSettingsBaseCurrency(activeTrip.baseCurrency ?? '');
    setSettingsStartDate(activeTrip.startDate ?? '');
    setSettingsBudgetPerPax(activeTrip.budgetPerPax != null ? String(activeTrip.budgetPerPax) : '');
    setSettingsAllowAnyDelete(activeTrip.allowAnyMemberToDelete === true);
  }, [activeTrip?.id, activeTrip?.baseCurrency, activeTrip?.startDate, activeTrip?.budgetPerPax, activeTrip?.allowAnyMemberToDelete]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = profileValue.trim().slice(0, 50);
    if (!trimmed) {
      setProfileSaveError('Enter a username');
      return;
    }
    setProfileSaveError(null);
    setProfileSaveSuccess(false);
    setProfileSaving(true);
    try {
      await setUsernameAndSave(trimmed);
      setProfileSaveSuccess(true);
    } catch (err) {
      setProfileSaveError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setProfileSaving(false);
    }
  };

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
      const budgetVal = createBudgetPerPax.trim() ? parseFloat(createBudgetPerPax) : null;
      const { data: trip } = await client.models.Trip.create({
        tripCode: code,
        name: createName.trim() || null,
        allowAnyMemberToDelete: createAllowAnyDelete,
        startDate: createStartDate.trim() || null,
        baseCurrency: createBaseCurrency || null,
        budgetPerPax: budgetVal != null && !Number.isNaN(budgetVal) ? budgetVal : null,
      });
      if (!trip) throw new Error('Create failed');
      const { userId } = await getCurrentUser();
      await client.models.TripMember.create({ tripId: trip.id, userId, role: 'owner' });
      await setActiveTripId(trip.id);
      setCreateCode('');
      setCreateName('');
      setCreateStartDate('');
      setCreateBaseCurrency('USD');
      setCreateBudgetPerPax('');
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

  if (loading || profileLoading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-2xl content-padding-x pb-28 pt-20 sm:pb-24 sm:pt-24 content-wrap">
      {/* Profile first */}
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Account</h1>
      <p className="mt-2 text-sm text-slate-600 sm:text-base">Profile and trips.</p>

      <section className="card mt-6 p-4 sm:mt-8 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-600">Manage your username and account.</p>
        {!profileAvailable && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">Profile (username) is not available yet</p>
            <p className="mt-1 text-xs text-amber-700">Deploy the backend so the UserProfile model is available (e.g. npx ampx sandbox), then refresh.</p>
          </div>
        )}
        {profileAvailable && (
          <>
            {loadError && <p className="mt-2 text-sm font-medium text-red-600">{loadError}</p>}
            <form onSubmit={handleProfileSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="profile-username" className="block text-sm font-medium text-slate-700">Display name</label>
                <input
                  id="profile-username"
                  type="text"
                  value={profileValue}
                  onChange={(e) => setProfileValue(e.target.value)}
                  placeholder="e.g. johndoe"
                  maxLength={50}
                  className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  disabled={profileSaving}
                />
              </div>
              {profileSaveError && <p className="text-sm font-medium text-red-600">{profileSaveError}</p>}
              {profileSaveSuccess && <p className="text-sm font-medium text-slate-600">Username saved.</p>}
              <button type="submit" disabled={profileSaving} className="btn-primary">{profileSaving ? 'Saving…' : 'Save username'}</button>
            </form>
          </>
        )}
        <div className="mt-6 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => signOut()}
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </section>

      <section className="card mt-6 p-4 sm:mt-8 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Password</h2>
        <p className="mt-1 text-sm text-slate-600">Use &quot;Forgot password&quot; on the sign-in screen or your identity provider (e.g. Google account settings) to change your password.</p>
      </section>

      {/* Trips */}
      <h2 className="mt-10 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Trips</h2>
      <p className="mt-1 text-sm text-slate-600 sm:text-base">Join a trip with a code or create your own.</p>
      {hasTrip && (
        <section className="card mt-6 p-4 sm:mt-10 sm:p-8">
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
              <div className="mt-3">
                <label htmlFor="trip-base-currency" className="block text-sm font-medium text-slate-700">Trip currency</label>
                <p className="mt-0.5 text-xs text-slate-500">Used when adding transactions and for O$P$.</p>
                <select
                  id="trip-base-currency"
                  value={settingsBaseCurrency}
                  disabled={settingsBusy}
                  onChange={(e) => setSettingsBaseCurrency(e.target.value)}
                  className="mt-2 block w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 min-h-[44px]"
                >
                  <option value="">Select currency</option>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="mt-4">
                <label htmlFor="trip-start-date" className="block text-sm font-medium text-slate-700">Trip start date</label>
                <p className="mt-0.5 text-xs text-slate-500">Used for Daily Journal &quot;Day X&quot;. Optional.</p>
                <input
                  id="trip-start-date"
                  type="date"
                  value={settingsStartDate}
                  disabled={settingsBusy}
                  onChange={(e) => setSettingsStartDate(e.target.value)}
                  className="mt-2 block w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                />
              </div>
              <div className="mt-4">
                <label htmlFor="trip-budget-pax" className="block text-sm font-medium text-slate-700">Budget per person</label>
                <p className="mt-0.5 text-xs text-slate-500">In trip currency. Optional; used for budget % on O$P$.</p>
                <input
                  id="trip-budget-pax"
                  type="number"
                  step="0.01"
                  min="0"
                  value={settingsBudgetPerPax}
                  onChange={(e) => setSettingsBudgetPerPax(e.target.value)}
                  placeholder="e.g. 500"
                  disabled={settingsBusy}
                  className="mt-2 block w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                />
              </div>
              <label className="mt-4 flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={settingsAllowAnyDelete}
                  disabled={settingsBusy}
                  onChange={(e) => setSettingsAllowAnyDelete(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                />
                <span className="text-sm text-slate-700">Any trip member can delete photos/videos</span>
              </label>
              <p className="mt-1 text-xs text-slate-500">If off, only the person who uploaded an item can delete it.</p>
              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  disabled={settingsBusy}
                  onClick={async () => {
                    if (!activeTrip) return;
                    setSettingsBusy(true);
                    setSettingsSaved(false);
                    try {
                      const budgetVal = settingsBudgetPerPax.trim() ? parseFloat(settingsBudgetPerPax) : null;
                      await client.models.Trip.update({
                        id: activeTrip.id,
                        baseCurrency: settingsBaseCurrency.trim() || null,
                        startDate: settingsStartDate.trim() || null,
                        budgetPerPax: budgetVal != null && !Number.isNaN(budgetVal) && budgetVal >= 0 ? budgetVal : null,
                        allowAnyMemberToDelete: settingsAllowAnyDelete,
                      });
                      setSettingsSaved(true);
                      refresh();
                      setTimeout(() => setSettingsSaved(false), 2000);
                    } finally {
                      setSettingsBusy(false);
                    }
                  }}
                  className="btn-primary"
                >
                  {settingsBusy ? 'Saving…' : 'Save settings'}
                </button>
                {settingsSaved && <span className="text-sm text-green-600">Saved</span>}
              </div>
            </div>
          )}
        </section>
      )}
      <section className="card mt-6 p-4 sm:mt-10 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Join a trip</h2>
        <p className="mt-2 text-sm text-slate-600">Enter the code someone shared with you.</p>
        <form onSubmit={handleJoin} className="mt-4 space-y-4 sm:mt-6 sm:space-y-5">
          <div>
            <label htmlFor="join-code" className="block text-sm font-semibold text-slate-700">Trip code</label>
            <input id="join-code" type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="e.g. BALI2026" className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" disabled={joinBusy} />
          </div>
          {joinError && <p className="text-sm font-medium text-red-600">{joinError}</p>}
          {joinSuccess && <p className="text-sm font-medium text-slate-600">You joined the trip.</p>}
          <button type="submit" disabled={joinBusy} className="btn-primary w-full sm:w-auto">{joinBusy ? 'Joining…' : 'Join trip'}</button>
        </form>
      </section>
      <section className="card mt-6 p-4 sm:mt-10 sm:p-8">
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Create a trip</h2>
        <p className="mt-2 text-sm text-slate-600">Pick a unique code others will use to join.</p>
        <form onSubmit={handleCreate} className="mt-4 space-y-4 sm:mt-6 sm:space-y-5">
          <div>
            <label htmlFor="create-code" className="block text-sm font-semibold text-slate-700">Trip code</label>
            <input id="create-code" type="text" value={createCode} onChange={(e) => setCreateCode(e.target.value)} placeholder="e.g. BALI2026" className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" disabled={createBusy} />
          </div>
          <div>
            <label htmlFor="create-name" className="block text-sm font-semibold text-slate-700">Name <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="create-name" type="text" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="e.g. Bali holiday" className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" disabled={createBusy} />
          </div>
          <div>
            <label htmlFor="create-start-date" className="block text-sm font-semibold text-slate-700">Start date <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="create-start-date" type="date" value={createStartDate} onChange={(e) => setCreateStartDate(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" disabled={createBusy} />
          </div>
          <div>
            <label htmlFor="create-base-currency" className="block text-sm font-semibold text-slate-700">Trip currency</label>
            <p className="mt-0.5 text-xs text-slate-500">Default when adding expenses. You can change this later in trip settings.</p>
            <select
              id="create-base-currency"
              value={createBaseCurrency}
              onChange={(e) => setCreateBaseCurrency(e.target.value)}
              className="mt-2 block w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              disabled={createBusy}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="create-budget-pax" className="block text-sm font-semibold text-slate-700">Budget per person <span className="font-normal text-slate-400">(optional)</span></label>
            <p className="mt-0.5 text-xs text-slate-500">In trip currency. Shown on O$P$.</p>
            <input
              id="create-budget-pax"
              type="number"
              step="0.01"
              min="0"
              value={createBudgetPerPax}
              onChange={(e) => setCreateBudgetPerPax(e.target.value)}
              placeholder="e.g. 500"
              disabled={createBusy}
              className="mt-2 block w-full max-w-xs rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            />
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
          <button type="submit" disabled={createBusy} className="btn-primary w-full sm:w-auto">{createBusy ? 'Creating…' : 'Create trip'}</button>
        </form>
      </section>
    </div>
  );
}
