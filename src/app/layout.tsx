'use client';

import { Plus_Jakarta_Sans } from 'next/font/google';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import ConfigureAmplifyClientSide from '@/components/ConfigureAmplify';
import LoginVideoBackground from '@/components/LoginVideoBackground';
import Navbar from '@/components/Navbar';
import SetUsernamePrompt from '@/components/SetUsernamePrompt';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${plusJakarta.variable} min-h-screen bg-white font-sans text-slate-900 antialiased`}
        style={{ fontFamily: 'var(--font-plus-jakarta), system-ui, sans-serif' }}
      >
        <ConfigureAmplifyClientSide />
        <LoginVideoBackground />
        <Authenticator socialProviders={['google']}>
          {({ signOut }) => (
            <>
              <SetUsernamePrompt />
              <Navbar signOut={signOut} />
              <main className="min-h-screen">{children}</main>
            </>
          )}
        </Authenticator>
      </body>
    </html>
  );
}
