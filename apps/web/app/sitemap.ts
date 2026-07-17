import type { MetadataRoute } from 'next';

import { getMarketingSiteOrigin } from '~/lib/app-host-routing';
import { buildMarketingSitemap } from '~/lib/seo/marketing-sitemap';
import {
  ALWAYS_INDEXABLE_PATHS,
  isSearchIndexingAllowed,
} from '~/lib/seo/search-indexing';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isSearchIndexingAllowed()) {
    const base = getMarketingSiteOrigin().replace(/\/$/, '');

    // Legal trust pages stay discoverable while the rest of the site is gated.
    return ALWAYS_INDEXABLE_PATHS.map((path) => ({
      url: `${base}${path}`,
      changeFrequency: 'yearly' as const,
      priority: 0.3,
    }));
  }

  return buildMarketingSitemap();
}
