'use client';

import { useState, useEffect } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useUserProfile } from '@/hooks/useUserProfile';

export default function ProfilePage() {
  const { username, suggestedUsername, hasProfile, loading, error: loadError, setUsernameAndSave, profileAvailable } = useUserProfile();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setValue(username ?? suggestedUsername ?? '');
  }, [username, suggestedUsername]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim().slice(0, 50);
    if (!trimmed) {
      setSaveError('Enter a username');
      return;
    }
    setSaveError(null);
    setSaveSuccess(false);
    setSaving(true);
    try {
      await setUsernameAndSave(trimmed);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <>
      <div className="h-14 sm:h-16" />
      <div className="mx-auto max-w-xl px-6 pb-24 py-8 sm:pb-0 sm:px-6 sm:py-12 safe-area-padding content-wrap">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-2xl">Profile</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">Manage your username and account settings.</p>
        {!profileAvailable && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <p className="font-medium text-amber-800">Profile (username) is not available yet</p>
            <p className="mt-2 text-sm text-amber-700">Deploy the backend so the UserProfile model is available (e.g. npx ampx sandbox), then refresh.</p>
          </div>
        )}
        {profileAvailable && (
          <section className="card mt-6 p-4 sm:mt-8 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-900">Username</h2>
            <p className="mt-1 text-sm text-slate-600">This is how you appear on photos and videos you upload.</p>
            {loadError && <p className="mt-2 text-sm font-medium text-red-600">{loadError}</p>}
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label htmlFor="profile-username" className="block text-sm font-medium text-slate-700">Display name</label>
                <input
                  id="profile-username"
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="e.g. johndoe"
                  maxLength={50}
                  className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm font-medium text-red-600">{saveError}</p>}
              {saveSuccess && <p className="text-sm font-medium text-slate-600">Username saved.</p>}
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save username'}</button>
            </form>
          </section>
        )}
        <section className="card mt-6 p-4 sm:mt-8 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Password</h2>
          <p className="mt-1 text-sm text-slate-600">Use &quot;Forgot password&quot; on the sign-in screen or your identity provider (e.g. Google account settings) to change your password.</p>
        </section>
      </div>
    </>
  );
}
