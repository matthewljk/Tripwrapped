'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const REDIRECT_KEY = 'auth_redirect';

export function setAuthRedirectToHome() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(REDIRECT_KEY, 'home');
  }
}

/**
 * When mounted and authenticated, redirects to / (add page) once if sessionStorage has auth_redirect=home.
 */
export default function RedirectToTripsIfNeeded() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const redirect = window.sessionStorage.getItem(REDIRECT_KEY);
    if (redirect === 'home' && pathname !== '/') {
      window.sessionStorage.removeItem(REDIRECT_KEY);
      router.replace('/');
    }
  }, [pathname, router]);

  return null;
}
