import { Metadata } from 'next';
import './globals.css';
import AppProviders from './components/AppProviders';

export const metadata: Metadata = {
  title: 'ServSwap - Trade Services, Not Money',
  description: 'A platform to exchange services with others using a barter system.',
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon/apple-touch-icon.png',
    other: [
      {
        rel: 'icon',
        sizes: '16x16',
        url: '/favicon/favicon-16x16.png',
      },
      {
        rel: 'icon',
        sizes: '32x32',
        url: '/favicon/favicon-32x32.png',
      },
      {
        rel: 'android-chrome',
        sizes: '192x192',
        url: '/favicon/android-chrome-192x192.png',
      },
      {
        rel: 'android-chrome',
        sizes: '512x512',
        url: '/favicon/android-chrome-512x512.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AppProviders>
          {/* We won't put Header here since some pages have their own special headers */}
          <main className="min-h-screen">
            {children}
          </main>
          {/* We won't put Footer here for the same reason - some pages have custom layouts */}
        </AppProviders>
      </body>
    </html>
  );
}
