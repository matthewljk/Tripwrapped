'use client';

import { useState, useEffect, useCallback } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

function isUserProfileAvailable(): boolean {
  const model = (client.models as Record<string, unknown>)?.UserProfile;
  return typeof model === 'object' && model !== null && typeof (model as { list?: unknown }).list === 'function';
}

export function suggestUsernameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30) || 'user';
}

export function useUserProfile() {
  const [username, setUsername] = useState<string | null>(null);
  const [suggestedUsername, setSuggestedUsername] = useState<string | null>(null);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { userId } = await getCurrentUser();
      const attrs = (await fetchUserAttributes().catch(() => ({}))) as Record<string, string>;
      const email = attrs.email ?? attrs['custom:email'] ?? '';
      const name = attrs.name ?? attrs.given_name ?? '';
      const suggestion = name.trim()
        ? name.trim().replace(/\s+/g, '_').slice(0, 30)
        : suggestUsernameFromEmail(email);
      setSuggestedUsername(suggestion || 'user');
      if (!isUserProfileAvailable()) {
        setUsername(null);
        setHasProfile(false);
        setLoading(false);
        return;
      }
      const { data: profiles } = await client.models.UserProfile.list({
        filter: { userId: { eq: userId } },
      });
      const profile = profiles?.[0];
      if (profile?.username) {
        setUsername(profile.username);
        setHasProfile(true);
      } else if (name.trim()) {
        const displayName = name.trim().replace(/\s+/g, '_').slice(0, 30);
        await client.models.UserProfile.create({ userId, username: displayName });
        setUsername(displayName);
        setHasProfile(true);
      } else {
        setUsername(null);
        setHasProfile(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
      setHasProfile(false);
      setUsername(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setUsernameAndSave = useCallback(async (newUsername: string) => {
    const trimmed = newUsername.trim().slice(0, 50);
    if (!trimmed) return;
    if (!isUserProfileAvailable()) {
      throw new Error('Profile is not available yet. Deploy the backend so the UserProfile model is available, then refresh.');
    }
    try {
      const { userId } = await getCurrentUser();
      const { data: existing } = await client.models.UserProfile.list({
        filter: { userId: { eq: userId } },
      });
      if (existing?.[0]) {
        await client.models.UserProfile.update({
          id: existing[0].id,
          username: trimmed,
        });
      } else {
        await client.models.UserProfile.create({ userId, username: trimmed });
      }
      setUsername(trimmed);
      setHasProfile(true);
    } catch (err) {
      throw err;
    }
  }, []);

  return {
    username,
    suggestedUsername,
    hasProfile,
    loading,
    error,
    refresh: load,
    setUsernameAndSave,
    profileAvailable: isUserProfileAvailable(),
  };
}
