import type { MetadataRoute } from 'next';
import { appUrl } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/butik/tilmeld'],
      disallow: ['/admin', '/butik/', '/virksomhed', '/logistik', '/g/', '/api/', '/lead'],
    },
    sitemap: `${appUrl()}/sitemap.xml`,
  };
}
