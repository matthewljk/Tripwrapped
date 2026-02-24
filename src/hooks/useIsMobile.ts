'use client';

import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT_PX = 768;

/**
 * Detect if we should use mobile layout (narrow viewport or mobile device).
 * Uses viewport width first; optionally considers user agent so desktop
 * with a narrow window can keep desktop layout if desired.
 */
function getIsMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < MOBILE_BREAKPOINT_PX;
}

function getIsMobileUserAgent(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua);
}

/**
 * Returns true when viewport is below the mobile breakpoint (768px).
 * Updates on resize. Use this to show bottom nav, adjust padding, etc.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => setIsMobile(getIsMobileViewport());
    update();
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    const listener = () => update();
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, []);

  return isMobile;
}

/**
 * Returns 'mobile' when user agent suggests a mobile/tablet device; otherwise 'desktop'.
 * This keeps the webapp (desktop browser) on desktop layout even when the window
 * is resized narrow. Mobile devices get mobile layout (bottom nav, etc.).
 */
export function useLayoutMode(): 'mobile' | 'desktop' {
  const [mode, setMode] = useState<'mobile' | 'desktop'>('desktop');

  useEffect(() => {
    setMode(getIsMobileUserAgent() ? 'mobile' : 'desktop');
  }, []);

  return mode;
}
