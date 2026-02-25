'use client';

import { useState, useEffect, useRef } from 'react';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../../amplify/data/resource';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useActiveTrip } from '@/hooks/useActiveTrip';
import { useUserProfile } from '@/hooks/useUserProfile';

const client = generateClient<Schema>();

const CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD', 'AUD', 'JPY', 'KRW', 'CAD', 'CHF', 'THB', 'MYR', 'IDR', 'PHP', 'VND'];

export default function TripsPage() {
  const { trips, activeTripId, activeTrip, setActiveTripId, leaveTrip, loading, hasTrip, refresh } = useActiveTrip();
  const { username, suggestedUsername, hasProfile, loading: profileLoading, error: loadError, setUsernameAndSave, profileAvailable } = useUserProfile();
  const [profileValue, setProfileValue] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState<string | null>(null);
  const [profileSaveSuccess, setProfileSaveSuccess] = useState(false);
  const [createCode, setCreateCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createBaseCurrency, setCreateBaseCurrency] = useState('SGD');
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
  const [settingsEndDate, setSettingsEndDate] = useState('');
  const [settingsBudgetPerPax, setSettingsBudgetPerPax] = useState('');
  const [settingsAllowAnyDelete, setSettingsAllowAnyDelete] = useState(false);
  const [createSectionExpanded, setCreateSectionExpanded] = useState(false);
  const [settingsSectionExpanded, setSettingsSectionExpanded] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const didAutoExpandSettingsRef = useRef(false);

  useEffect(() => {
    setProfileValue(username ?? suggestedUsername ?? '');
  }, [username, suggestedUsername]);

  // When switching trip, allow auto-expand again for the new trip
  useEffect(() => {
    didAutoExpandSettingsRef.current = false;
  }, [activeTripId]);

  // If trip already has settings (currency, dates, budget), show settings expanded by default
  useEffect(() => {
    if (!activeTrip) return;
    const hasSettings = !!(
      (activeTrip.baseCurrency ?? '').trim() ||
      (activeTrip.startDate ?? '').trim() ||
      (activeTrip.endDate ?? '').trim() ||
      (activeTrip.budgetPerPax != null && activeTrip.budgetPerPax > 0)
    );
    if (hasSettings && !didAutoExpandSettingsRef.current) {
      setSettingsSectionExpanded(true);
      didAutoExpandSettingsRef.current = true;
    }
  }, [activeTrip, activeTripId]);

  // Keep trip settings form in sync with saved trip data; don't overwrite with empty (so saved KRW stays when trip data is stale)
  useEffect(() => {
    if (!activeTrip) return;
    setSettingsBaseCurrency((prev) => (activeTrip.baseCurrency?.trim() ? activeTrip.baseCurrency!.trim() : prev));
    setSettingsStartDate((prev) => (activeTrip.startDate?.trim() ? activeTrip.startDate.trim() : prev));
    setSettingsEndDate((prev) => (activeTrip.endDate?.trim() ? activeTrip.endDate.trim() : prev));
    setSettingsBudgetPerPax((prev) => (activeTrip.budgetPerPax != null && !Number.isNaN(activeTrip.budgetPerPax) ? String(activeTrip.budgetPerPax) : prev));
    setSettingsAllowAnyDelete(activeTrip.allowAnyMemberToDelete === true);
  }, [activeTrip?.id, activeTrip?.baseCurrency, activeTrip?.startDate, activeTrip?.endDate, activeTrip?.budgetPerPax, activeTrip?.allowAnyMemberToDelete]);

  // When user first expands Trip settings, sync from trip but don't overwrite with empty (trip may not have refreshed yet after save)
  const prevExpandedRef = useRef(false);
  useEffect(() => {
    const justExpanded = settingsSectionExpanded && !prevExpandedRef.current;
    prevExpandedRef.current = settingsSectionExpanded;
    if (justExpanded && activeTrip) {
      const tc = (activeTrip.baseCurrency ?? '').trim();
      if (tc) setSettingsBaseCurrency(activeTrip.baseCurrency ?? '');
      const ts = (activeTrip.startDate ?? '').trim();
      if (ts) setSettingsStartDate(activeTrip.startDate ?? '');
      const te = (activeTrip.endDate ?? '').trim();
      if (te) setSettingsEndDate(activeTrip.endDate ?? '');
      if (activeTrip.budgetPerPax != null && activeTrip.budgetPerPax > 0) setSettingsBudgetPerPax(String(activeTrip.budgetPerPax));
      setSettingsAllowAnyDelete(activeTrip.allowAnyMemberToDelete === true);
    }
  }, [settingsSectionExpanded, activeTrip]);

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
        endDate: createEndDate.trim() || null,
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
      setCreateEndDate('');
      setCreateBaseCurrency('SGD');
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
      <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Account</h1>
      <p className="mt-2 text-sm text-slate-600 sm:text-base">Trips and profile.</p>

      {/* 1. Active trip first */}
      {hasTrip && (
        <section className="card mt-6 p-4 sm:mt-8 sm:p-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Active trip</p>
          <p className="mt-2 text-xl font-bold text-slate-900">{activeTrip ? activeTrip.name || activeTrip.tripCode : '—'}</p>
          {activeTrip && (
            <p className="mt-2 text-slate-600">Share code: <span className="font-mono font-semibold text-slate-900">{activeTrip.tripCode}</span></p>
          )}
          <div className="mt-6">
            <label htmlFor="trip-select" className="block text-sm font-medium text-slate-700">Active trip</label>
            <select
              id="trip-select"
              value={activeTripId ?? ''}
              onChange={(e) => setActiveTripId(e.target.value || null)}
              className="mt-2 block w-full max-w-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              {trips.map((t) => (
                <option key={t.id} value={t.id}>{t.name || t.tripCode} · {t.tripCode}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Switch which trip you’re viewing and editing.</p>
          </div>
          {activeTrip?.isActualMember && activeTripId && (
            <div className="mt-4">
              <button
                type="button"
                disabled={leaveBusy}
                onClick={async () => {
                  if (!window.confirm('Leave this trip? You’ll stop being a member. If you were the last member, the trip and all its photos and data will be deleted.')) return;
                  setLeaveBusy(true);
                  try {
                    await leaveTrip(activeTripId);
                  } finally {
                    setLeaveBusy(false);
                  }
                }}
                className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-50"
              >
                {leaveBusy ? 'Leaving…' : 'Leave trip'}
              </button>
            </div>
          )}
          {/* Trip settings: expandable; any member can edit; Save takes effect */}
          {activeTrip && (
            <div className="mt-6 border-t border-slate-200 pt-6">
              <button
                type="button"
                onClick={() => setSettingsSectionExpanded((e) => !e)}
                className="flex w-full items-center justify-between text-left"
                aria-expanded={settingsSectionExpanded}
              >
                <span className="text-sm font-semibold text-slate-700">Trip settings</span>
                <span className="text-slate-500" aria-hidden>{settingsSectionExpanded ? '−' : '+'}</span>
              </button>
              {settingsSectionExpanded && (
                <>
              <p className="mt-1 text-xs text-slate-500">Any trip member can change these. Save to apply.</p>
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
                <label htmlFor="trip-end-date" className="block text-sm font-medium text-slate-700">Trip end date</label>
                <p className="mt-0.5 text-xs text-slate-500">Optional. Used for trip duration and date range.</p>
                <input
                  id="trip-end-date"
                  type="date"
                  value={settingsEndDate}
                  disabled={settingsBusy}
                  onChange={(e) => setSettingsEndDate(e.target.value)}
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
                        endDate: settingsEndDate.trim() || null,
                        budgetPerPax: budgetVal != null && !Number.isNaN(budgetVal) && budgetVal >= 0 ? budgetVal : null,
                        allowAnyMemberToDelete: settingsAllowAnyDelete,
                      });
                      setSettingsSaved(true);
                      setSettingsBaseCurrency(settingsBaseCurrency.trim());
                      setSettingsStartDate(settingsStartDate.trim());
                      setSettingsEndDate(settingsEndDate.trim());
                      setSettingsBudgetPerPax(budgetVal != null && !Number.isNaN(budgetVal) && budgetVal >= 0 ? String(budgetVal) : '');
                      const savedCurrency = settingsBaseCurrency.trim();
                      if (savedCurrency && typeof sessionStorage !== 'undefined') {
                        sessionStorage.setItem(`tripwrapped-trip-currency-${activeTrip.id}`, savedCurrency);
                      }
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
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* 2. Join a trip */}
      <section className="card mt-6 p-4 sm:mt-8 sm:p-6">
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

      {/* 3. Create a trip (click to expand) */}
      <section className="card mt-6 p-4 sm:mt-8 sm:p-6">
        <button
          type="button"
          onClick={() => setCreateSectionExpanded((e) => !e)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={createSectionExpanded}
        >
          <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Create a trip</h2>
          <span className="text-slate-500" aria-hidden>{createSectionExpanded ? '−' : '+'}</span>
        </button>
        {createSectionExpanded && (
          <>
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
            <label htmlFor="create-end-date" className="block text-sm font-semibold text-slate-700">End date <span className="font-normal text-slate-400">(optional)</span></label>
            <input id="create-end-date" type="date" value={createEndDate} onChange={(e) => setCreateEndDate(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2" disabled={createBusy} />
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
          </>
        )}
      </section>

      {/* 4. Profile (username) */}
      <section className="card mt-6 p-4 sm:mt-8 sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        <p className="mt-1 text-sm text-slate-600">Your display name.</p>
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
        {/* 5. Sign out */}
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
    </div>
  );
}
