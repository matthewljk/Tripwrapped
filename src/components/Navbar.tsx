'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavbarProps = {
  signOut?: () => void;
  isMobile?: boolean;
};

const navLinks = [
  { href: '/', label: 'Upload', icon: 'upload' },
  { href: '/gallery', label: 'Gallery', icon: 'gallery' },
  { href: '/trips', label: 'Trips', icon: 'trips' },
  { href: '/profile', label: 'Profile', icon: 'profile' },
];

function NavIcon({ icon }: { icon: string }) {
  const c = 'h-6 w-6';
  switch (icon) {
    case 'upload':
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 16m4-4v12" />
        </svg>
      );
    case 'gallery':
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    case 'trips':
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      );
    case 'profile':
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function Navbar({ signOut, isMobile = false }: NavbarProps) {
  const pathname = usePathname();
  const showDesktopNav = !isMobile;
  const showBottomNav = isMobile;

  return (
    <>
      {/* Top bar: logo + desktop nav + sign out; on mobile just logo + sign out icon */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md safe-area-padding">
        <nav className="mx-auto flex h-14 min-h-[44px] max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link
            href="/"
            className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
            aria-label="TripWrapped home"
          >
            TripWrapped
          </Link>
          {showDesktopNav && (
          <div className="flex items-center gap-2">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`min-h-[44px] min-w-[44px] rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                    isActive ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
            {signOut && (
              <button
                type="button"
                onClick={signOut}
                className="ml-2 min-h-[44px] min-w-[44px] rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900"
              >
                Sign out
              </button>
            )}
          </div>
          )}
          {signOut && showBottomNav && (
            <button
              type="button"
              onClick={signOut}
              className="min-h-[44px] min-w-[44px] rounded-xl p-2.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Sign out"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </nav>
      </header>

      {/* Bottom nav: only when isMobile (phone/tablet or narrow + mobile UA) */}
      {showBottomNav && (
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-md safe-area-padding safe-area-bottom"
        aria-label="Main navigation"
      >
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {navLinks.map(({ href, label, icon }) => {
            const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex min-h-[56px] min-w-[56px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-blue-700' : 'text-slate-500 active:bg-slate-100'
                }`}
              >
                <NavIcon icon={icon} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      )}
    </>
  );
}
