import type { MetadataRoute } from 'next';

import { buildMarketingSitemap } from '~/lib/seo/marketing-sitemap';
import { isSearchIndexingAllowed } from '~/lib/seo/search-indexing';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isSearchIndexingAllowed()) {
    return [];
  }

  return buildMarketingSitemap();
}
