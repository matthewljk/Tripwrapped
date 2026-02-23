'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavbarProps = {
  signOut?: () => void;
};

const navLinks = [
  { href: '/', label: 'Upload' },
  { href: '/gallery', label: 'Gallery' },
  { href: '/trips', label: 'Trips' },
  { href: '/profile', label: 'Profile' },
];

export default function Navbar({ signOut }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-slate-900">
          TripWrapped
        </Link>
        <div className="flex items-center gap-2">
          {navLinks.map(({ href, label }) => {
            const isActive =
              pathname === href || (href !== '/' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
                  isActive
                    ? 'bg-blue-700 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
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
              className="ml-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-all duration-200 hover:bg-slate-100 hover:text-slate-900"
            >
              Sign out
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}
