import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/format';
import { TOWNS, townSlug } from '@/lib/towns';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appUrl();
  const pages = ['', '/bestil', '/saadan-virker-det', '/butikker', '/levering', '/skatteregler', '/butik/tilmeld', '/kontakt', '/handelsbetingelser', '/privatliv'];
  return [...pages.map((p) => ({ url: `${base}${p}` })), ...TOWNS.map((t) => ({ url: `${base}/firmajulegaver/${townSlug(t)}` }))];
}
