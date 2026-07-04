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

import type { SegmentLandingConfig } from './segment-landing-pages';

export function segmentCanonicalPath(slug: SegmentLandingConfig['slug']) {
  return `/${slug}`;
}

export function buildSegmentMetadata(config: SegmentLandingConfig): Metadata {
  return buildMarketingMetadata({
    title: config.seo.title,
    description: config.seo.description,
    path: segmentCanonicalPath(config.slug),
    ogType: 'segment',
    keywords: config.seo.keywords,
  });
}

export function buildSegmentJsonLd(config: SegmentLandingConfig) {
  const path = segmentCanonicalPath(config.slug);
  const pageUrl = absoluteUrl(path);

  return schemaGraph([
    webPageJsonLd({
      name: config.seo.title,
      description: config.seo.description,
      path,
    }),
    softwareApplicationJsonLd({
      name: `Ozer — ${config.hero.eyebrow}`,
      description: config.seo.description,
      url: pageUrl,
      offers: config.pricingPlans.map((plan) => ({
        name: plan.name,
        price: plan.priceGbp,
        description: plan.description,
        url: pageUrl,
      })),
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: config.hero.eyebrow, path },
    ]),
    faqPageJsonLd(config.faqs),
  ]);
}

export function segmentJsonLdScript(config: SegmentLandingConfig) {
  return JSON.stringify(buildSegmentJsonLd(config));
}
