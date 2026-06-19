import 'server-only';

import type { MetadataRoute } from 'next';

import { createCmsClient } from '@kit/cms';

import { getMarketingSiteOrigin } from '~/lib/app-host-routing';
import { getPublishedBlogPostsForSitemap } from '~/lib/blog';
import { FEATURE_SITEMAP_PATHS } from '~/lib/marketing/feature-landing-pages';
import { APP_LANDING_SLUGS } from '~/lib/marketing/app-landing-pages';
import type { SegmentSlug } from '~/lib/marketing/segment-landing-pages';

const SEGMENT_SLUGS: SegmentSlug[] = ['personal', 'work', 'property', 'community'];

const STATIC_MARKETING_PATHS: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'];
}> = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/docs', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/changelog', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/apps', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/privacy-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms-of-service', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/cookie-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/trust', priority: 0.4, changeFrequency: 'monthly' },
];

type SitemapEntry = MetadataRoute.Sitemap[number];

function entry(
  base: string,
  path: string,
  options?: {
    lastModified?: Date | string;
    priority?: number;
    changeFrequency?: SitemapEntry['changeFrequency'];
  },
): SitemapEntry {
  return {
    url: `${base}${path || '/'}`,
    lastModified: options?.lastModified ?? new Date(),
    changeFrequency: options?.changeFrequency ?? 'monthly',
    priority: options?.priority ?? 0.7,
  };
}

async function loadCmsPaths(
  base: string,
  collection: string,
  pathPrefix: string,
): Promise<SitemapEntry[]> {
  try {
    const client = await createCmsClient();
    const { items } = await client.getContentItems({
      collection,
      content: false,
      limit: Infinity,
    });

    return items.map((item) =>
      entry(base, `${pathPrefix}/${item.slug}`, {
        lastModified: item.publishedAt
          ? new Date(item.publishedAt)
          : new Date(),
        priority: 0.65,
        changeFrequency: 'monthly',
      }),
    );
  } catch {
    return [];
  }
}

export async function buildMarketingSitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getMarketingSiteOrigin().replace(/\/$/, '');

  const staticEntries = [
    ...STATIC_MARKETING_PATHS.map(({ path, priority, changeFrequency }) =>
      entry(base, path, { priority, changeFrequency }),
    ),
    ...SEGMENT_SLUGS.map((slug) =>
      entry(base, `/${slug}`, { priority: 0.9, changeFrequency: 'weekly' }),
    ),
    ...APP_LANDING_SLUGS.map((slug) =>
      entry(base, `/apps/${slug}`, { priority: 0.8, changeFrequency: 'monthly' }),
    ),
  ];

  const [blogPosts, docs, changelog] = await Promise.all([
    getPublishedBlogPostsForSitemap(),
    loadCmsPaths(base, 'documentation', '/docs'),
    loadCmsPaths(base, 'changelog', '/changelog'),
  ]);

  const blogEntries = blogPosts.map((post) =>
    entry(base, `/blog/${post.slug}`, {
      lastModified: new Date(post.updated_at),
      priority: 0.65,
      changeFrequency: 'monthly',
    }),
  );

  const featureEntries = FEATURE_SITEMAP_PATHS.map((path) =>
    entry(base, path, {
      priority: 0.8,
      changeFrequency: 'monthly',
    }),
  );

  return [...staticEntries, ...featureEntries, ...blogEntries, ...docs, ...changelog];
}
