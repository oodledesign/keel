import type { MetadataRoute } from 'next';

import appConfig from '~/config/app.config';

export default function robots(): MetadataRoute.Robots {
  const base = appConfig.url.replace(/\/$/, '');

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/home/', '/admin/', '/api/', '/auth/'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
