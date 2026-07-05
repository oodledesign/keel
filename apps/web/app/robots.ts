import type { MetadataRoute } from 'next';

import { getMarketingSiteOrigin } from '~/lib/app-host-routing';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  const base = getMarketingSiteOrigin().replace(/\/$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
