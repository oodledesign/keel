import type { MetadataRoute } from 'next';

import { getMarketingSiteOrigin } from '~/lib/app-host-routing';

const MARKETING_PATHS = [
  '',
  '/personal',
  '/work',
  '/property',
  '/community',
  '/apps',
  '/apps/signatures',
  '/apps/rankly',
  '/apps/feedflow',
  '/apps/videos',
  '/pricing',
  '/faq',
  '/contact',
  '/blog',
  '/docs',
  '/changelog',
  '/privacy-policy',
  '/terms-of-service',
  '/cookie-policy',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getMarketingSiteOrigin().replace(/\/$/, '');
  const now = new Date();

  return MARKETING_PATHS.map((path) => ({
    url: `${base}${path || '/'}`,
    lastModified: now,
    changeFrequency: path === '' || path.startsWith('/personal') || path.startsWith('/work') ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path.match(/^\/(personal|work|property|community)$/) ? 0.9 : 0.7,
  }));
}
