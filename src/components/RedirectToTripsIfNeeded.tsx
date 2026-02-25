'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const REDIRECT_KEY = 'auth_redirect';

export function setAuthRedirectToTrips() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(REDIRECT_KEY, 'trips');
  }
}

/**
 * When mounted and authenticated, redirects to /trips once if sessionStorage has auth_redirect=trips.
 */
export default function RedirectToTripsIfNeeded() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const redirect = window.sessionStorage.getItem(REDIRECT_KEY);
    if (redirect === 'trips' && pathname !== '/trips') {
      window.sessionStorage.removeItem(REDIRECT_KEY);
      router.replace('/trips');
    }
  }, [pathname, router]);

  return null;
}
