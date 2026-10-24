import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/format';
import { publicShops } from '@/lib/shops';
import { TOWNS, townSlug } from '@/lib/towns';

// Kun sider, Google skal finde. Bysider kommer med, når der er en butik i byen.
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const now = new Date();
  const page = (path: string, priority: number, changeFrequency: 'daily' | 'weekly' | 'monthly' | 'yearly' = 'weekly') => ({ url: `${base}${path}`, lastModified: now, changeFrequency, priority });
  const shops = await publicShops();
  const towns = TOWNS.filter((t) => shops.some((s) => s.town?.trim().toLowerCase() === t.toLowerCase()));
  return [
    page('', 1, 'daily'),
    page('/gaver', 0.9, 'daily'),
    page('/saadan-virker-det', 0.9),
    page('/bestil', 0.8),
    page('/skatteregler', 0.8, 'monthly'),
    page('/levering', 0.7),
    page('/butikker', 0.7, 'daily'),
    page('/butik/tilmeld', 0.6, 'monthly'),
    page('/kontakt', 0.5, 'monthly'),
    ...towns.map((t) => page(`/firmajulegaver/${townSlug(t)}`, 0.7)),
    page('/handelsbetingelser', 0.2, 'yearly'),
    page('/privatliv', 0.2, 'yearly'),
  ];
}
