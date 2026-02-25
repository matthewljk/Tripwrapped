'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserProfile } from '@/hooks/useUserProfile';

export default function SetUsernamePrompt() {
  const router = useRouter();
  const { suggestedUsername, hasProfile, loading, setUsernameAndSave, profileAvailable } = useUserProfile();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (suggestedUsername) setValue(suggestedUsername);
  }, [suggestedUsername]);

  if (loading || hasProfile === true || !profileAvailable) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim().slice(0, 50);
    if (!trimmed) {
      setError('Enter a username');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await setUsernameAndSave(trimmed);
      router.replace('/trips');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl" role="dialog" aria-labelledby="set-username-title" aria-modal="true">
        <h2 id="set-username-title" className="text-xl font-bold text-slate-900">Choose your username</h2>
        <p className="mt-2 text-sm text-slate-600">This is how you’ll appear on photos and videos you upload.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            id="username-input"
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. johndoe"
            maxLength={50}
            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            disabled={saving}
          />
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Saving…' : 'Continue'}</button>
        </form>
      </div>
    </div>
  );
}
