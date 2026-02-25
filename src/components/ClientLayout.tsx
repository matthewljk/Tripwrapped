'use client';

import { useEffect } from 'react';
import { Authenticator } from '@aws-amplify/ui-react';
import ConfigureAmplifyClientSide from '@/components/ConfigureAmplify';
import LoginVideoBackground from '@/components/LoginVideoBackground';
import Navbar from '@/components/Navbar';
import SetUsernamePrompt from '@/components/SetUsernamePrompt';
import { useLayoutMode } from '@/hooks/useIsMobile';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const layoutMode = useLayoutMode();

  useEffect(() => {
    document.body.classList.remove('layout-mobile', 'layout-desktop');
    document.body.classList.add(layoutMode === 'mobile' ? 'layout-mobile' : 'layout-desktop');
    return () => {
      document.body.classList.remove('layout-mobile', 'layout-desktop');
    };
  }, [layoutMode]);

  const isMobile = layoutMode === 'mobile';

  return (
    <>
      <ConfigureAmplifyClientSide />
      <LoginVideoBackground />
      <Authenticator socialProviders={['google']}>
        <>
          <SetUsernamePrompt />
          <Navbar isMobile={isMobile} />
          <main className={isMobile ? 'min-h-dscreen pb-20' : 'min-h-dscreen'}>{children}</main>
        </>
      </Authenticator>
    </>
  );
}
