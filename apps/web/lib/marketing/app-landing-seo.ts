import type { Metadata } from 'next';

import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  absoluteUrl,
  breadcrumbJsonLd,
  faqPageJsonLd,
  schemaGraph,
  softwareApplicationJsonLd,
  webPageJsonLd,
} from '~/lib/seo/schema';

import type { AppLandingConfig } from './app-landing-pages';

export function appCanonicalPath(slug: AppLandingConfig['slug']) {
  return `/apps/${slug}`;
}

export function buildAppMetadata(config: AppLandingConfig): Metadata {
  return buildMarketingMetadata({
    title: config.seo.title,
    description: config.seo.description,
    path: appCanonicalPath(config.slug),
    ogType: 'app',
    keywords: config.seo.keywords,
  });
}

export function buildAppJsonLd(config: AppLandingConfig) {
  const path = appCanonicalPath(config.slug);
  const pageUrl = absoluteUrl(path);

  return schemaGraph([
    webPageJsonLd({
      name: config.seo.title,
      description: config.seo.description,
      path,
    }),
    softwareApplicationJsonLd({
      name: `Ozer ${config.name}`,
      description: config.seo.description,
      url: pageUrl,
      offers: [
        {
          name: config.name,
          price: config.fromPriceGbp,
          description:
            config.hero.priceBadge ?? `From £${config.fromPriceGbp} per month`,
          url: pageUrl,
        },
      ],
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Apps', path: '/apps' },
      { name: config.name, path },
    ]),
    faqPageJsonLd(config.faqs),
  ]);
}

export function appJsonLdScript(config: AppLandingConfig) {
  return JSON.stringify(buildAppJsonLd(config));
}
