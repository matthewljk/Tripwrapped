'use client';

import { useEffect } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import type { AuthUser } from 'aws-amplify/auth';
import LoginCover from '@/components/LoginCover';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSignedIn: (user: AuthUser) => void;
};

/**
 * Modal that shows the Amplify Authenticator (sign-in / create account).
 * When the user signs in, calls onSignedIn and onClose.
 */
export default function AuthModal({ isOpen, onClose, onSignedIn }: Props) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      style={{
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 touch-manipulation sm:right-4 sm:top-4"
          aria-label="Close"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <div id="auth-modal-title" className="sr-only">
          Sign in or create an account
        </div>
        <Authenticator
          socialProviders={['google']}
          components={{ Header: LoginCover }}
        >
          {({ user }) => <AuthModalCloseGuard user={user} onSignedIn={onSignedIn} onClose={onClose} />}
        </Authenticator>
      </div>
    </div>
  );
}

function AuthModalCloseGuard({
  user,
  onSignedIn,
  onClose,
}: {
  user: AuthUser | undefined;
  onSignedIn: (user: AuthUser) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (user) {
      onSignedIn(user);
      onClose();
    }
  }, [user, onSignedIn, onClose]);
  return null;
}
