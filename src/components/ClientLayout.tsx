'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';
import type { AuthUser } from 'aws-amplify/auth';
import { Authenticator } from '@aws-amplify/ui-react';
import ConfigureAmplifyClientSide from '@/components/ConfigureAmplify';
import AuthModal from '@/components/AuthModal';
import LoginLanding from '@/components/LoginLanding';
import LoginVideoBackground from '@/components/LoginVideoBackground';
import Navbar from '@/components/Navbar';
import RedirectToTripsIfNeeded, { setAuthRedirectToHome } from '@/components/RedirectToTripsIfNeeded';
import SetUsernamePrompt from '@/components/SetUsernamePrompt';
import { useLayoutMode } from '@/hooks/useIsMobile';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const layoutMode = useLayoutMode();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    document.body.classList.remove('layout-mobile', 'layout-desktop');
    document.body.classList.add(layoutMode === 'mobile' ? 'layout-mobile' : 'layout-desktop');
    return () => {
      document.body.classList.remove('layout-mobile', 'layout-desktop');
    };
  }, [layoutMode]);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const openAuthModal = () => {
    setAuthRedirectToHome();
    setAuthModalOpen(true);
  };

  const isMobile = layoutMode === 'mobile';

  if (!authChecked) {
    return (
      <>
        <ConfigureAmplifyClientSide />
        <div className="flex min-h-dscreen items-center justify-center bg-slate-100">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" aria-hidden />
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <ConfigureAmplifyClientSide />
        <LoginVideoBackground />
        <div data-landing className="relative min-h-dscreen">
          <LoginLanding onJoinTrip={openAuthModal} onCreateTrip={openAuthModal} />
          <AuthModal
            isOpen={authModalOpen}
            onClose={() => setAuthModalOpen(false)}
            onSignedIn={(u) => {
              setUser(u);
              setAuthModalOpen(false);
            }}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <ConfigureAmplifyClientSide />
      <Authenticator socialProviders={['google']}>
        <>
          <RedirectToTripsIfNeeded />
          <SetUsernamePrompt />
          <Navbar isMobile={isMobile} />
          <main className={isMobile ? 'min-h-dscreen pb-20' : 'min-h-dscreen'}>{children}</main>
        </>
      </Authenticator>
    </>
  );
}
