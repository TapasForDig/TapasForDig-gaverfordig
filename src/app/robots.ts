import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/format';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/butik/', '/virksomhed', '/logistik', '/gave', '/g/', '/api/'] },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
