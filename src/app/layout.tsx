import type { Metadata } from 'next';
import { SiteFooter } from '@/components/SiteFooter';
// Cairo hostes selv (ingen opslag hos Google Fonts, så besøgendes IP-adresse ikke sendes til Google)
import '@fontsource/cairo/400.css';
import '@fontsource/cairo/500.css';
import '@fontsource/cairo/600.css';
import '@fontsource/cairo/700.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Gaver For Dig – lokale firmagaver',
  description: 'Firmagaver fra lokale butikker i Vejen Kommune. Medarbejderen vælger selv, vi pakker og leverer samlet.',
};

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
