import type { Metadata } from 'next';

import appConfig from '~/config/app.config';

import type { SegmentLandingConfig } from './segment-landing-pages';

export function segmentCanonicalPath(slug: SegmentLandingConfig['slug']) {
  return `/${slug}`;
}

export function buildSegmentMetadata(config: SegmentLandingConfig): Metadata {
  const url = `${appConfig.url}${segmentCanonicalPath(config.slug)}`;

  return {
    title: config.seo.title,
    description: config.seo.description,
    keywords: config.seo.keywords,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: config.seo.title,
      description: config.seo.description,
      url,
      siteName: appConfig.name,
      type: 'website',
      locale: appConfig.locale,
    },
    twitter: {
      card: 'summary_large_image',
      title: config.seo.title,
      description: config.seo.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export function buildSegmentJsonLd(config: SegmentLandingConfig) {
  const pageUrl = `${appConfig.url}${segmentCanonicalPath(config.slug)}`;

  const faqPage =
    config.faqs.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: config.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer,
            },
          })),
        }
      : null;

  const softwareApplication = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${appConfig.name} — ${config.hero.eyebrow}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: config.seo.description,
    url: pageUrl,
    offers: config.pricingPlans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.priceGbp,
      priceCurrency: 'GBP',
      description: plan.description,
      url: pageUrl,
    })),
    provider: {
      '@type': 'Organization',
      name: appConfig.name,
      url: appConfig.url,
    },
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: appConfig.url,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: config.hero.eyebrow,
        item: pageUrl,
      },
    ],
  };

  const webPage = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: config.seo.title,
    description: config.seo.description,
    url: pageUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: appConfig.name,
      url: appConfig.url,
    },
  };

  return [webPage, softwareApplication, breadcrumb, faqPage].filter(Boolean);
}

export function segmentJsonLdScript(config: SegmentLandingConfig) {
  const graphs = buildSegmentJsonLd(config);
  return JSON.stringify(graphs.length === 1 ? graphs[0] : graphs);
}
