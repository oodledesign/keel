import type { Metadata } from 'next';

import appConfig from '~/config/app.config';
import { absoluteUrl } from '~/lib/seo/schema';
import { getSearchIndexingRobots } from '~/lib/seo/search-indexing';

export type OgImageType =
  | 'default'
  | 'pricing'
  | 'feature'
  | 'blog'
  | 'segment'
  | 'app'
  | 'legal';

/**
 * OG images are served by /api/og (ImageResponse).
 * Page-type variants share layout; title is passed as a query param.
 */
export function ogImageUrl(type: OgImageType, title: string): string {
  const params = new URLSearchParams({
    type,
    title: title.slice(0, 80),
  });
  return absoluteUrl(`/api/og?${params.toString()}`);
}

export function buildMarketingMetadata(input: {
  title: string;
  description: string;
  path: string;
  ogType?: OgImageType;
  keywords?: string[];
  openGraphType?: 'website' | 'article';
  publishedTime?: string;
  authors?: string[];
}): Metadata {
  const title = clampTitle(input.title);
  const description = clampDescription(input.description);
  const url = absoluteUrl(input.path);
  const image = ogImageUrl(input.ogType ?? 'default', title);

  return {
    title,
    description,
    keywords: input.keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      url,
      siteName: appConfig.name,
      type: input.openGraphType ?? 'website',
      locale: appConfig.locale,
      images: [
        {
          url: image,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.authors ? { authors: input.authors } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image],
    },
    robots: getSearchIndexingRobots({ path: input.path }),
  };
}

function clampTitle(title: string): string {
  if (title.length <= 60) return title;
  return `${title.slice(0, 57).trimEnd()}…`;
}

function clampDescription(description: string): string {
  if (description.length <= 155) return description;
  return `${description.slice(0, 152).trimEnd()}…`;
}
