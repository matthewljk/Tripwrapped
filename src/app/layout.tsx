import type { Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import '@aws-amplify/ui-react/styles.css';
import './globals.css';
import ClientLayout from '@/components/ClientLayout';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

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
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
