import type { MetadataRoute } from 'next';

import { getMarketingSiteOrigin } from '~/lib/app-host-routing';
import { isSearchIndexingAllowed } from '~/lib/seo/search-indexing';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  if (!isSearchIndexingAllowed()) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    };
  }

  const base = getMarketingSiteOrigin().replace(/\/$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/home/', '/admin/', '/api/', '/auth/'],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
