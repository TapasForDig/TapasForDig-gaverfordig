import type { Metadata, Viewport } from 'next';
import { appUrl } from '@/lib/format';
import { SiteFooter } from '@/components/SiteFooter';
// Cairo hostes selv (ingen opslag hos Google Fonts, så besøgendes IP-adresse ikke sendes til Google)
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/500.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: 'Firmajulegaver fra lokale butikker i Vejen Kommune – Gaver For Dig',
  description:
    'Lokale firmajulegaver i Vejen Kommune. I vælger gavebeløb, medarbejderne vælger selv en gave fra lokale butikker, og vi pakker og leverer samlet. Skattefri inden for reglerne.',
  applicationName: 'Gaver For Dig',
  openGraph: {
    type: 'website',
    locale: 'da_DK',
    siteName: 'Gaver For Dig',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Gaver For Dig – lokale firmajulegaver i Vejen Kommune' }],
  },
  twitter: { card: 'summary_large_image', images: ['/og.png'] },
  icons: { icon: '/favicon.png', apple: '/apple-touch-icon.png' },
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  formatDetection: { telephone: false },
};

export const viewport: Viewport = { themeColor: '#415743' };

export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <body>
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
