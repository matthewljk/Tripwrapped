'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

type NavbarProps = {
  signOut?: () => void;
  isMobile?: boolean;
};

const navLinks = [
  { href: '/', label: 'Add', icon: 'upload' },
  { href: '/gallery', label: 'Gallery', icon: 'gallery' },
  { href: '/journal', label: 'Journal', icon: 'journal' },
  { href: '/ops', label: 'O$P$', icon: 'money' },
  { href: '/wrap-it-up', label: 'Wrap It Up', icon: 'map' },
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
    case 'map':
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
        </svg>
      );
    case 'journal':
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      );
    case 'money':
      return (
        <svg className={c} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 sm:text-xl"
            aria-label="TripWrapped home"
          >
            <Image
              src="/login-videos/Icon.png"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 flex-shrink-0 sm:h-9 sm:w-9"
            />
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
