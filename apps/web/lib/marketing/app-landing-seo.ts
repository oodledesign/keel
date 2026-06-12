import type { Metadata } from 'next';

import appConfig from '~/config/app.config';

import type { AppLandingConfig } from './app-landing-pages';

export function appCanonicalPath(slug: AppLandingConfig['slug']) {
  return `/apps/${slug}`;
}

export function buildAppMetadata(config: AppLandingConfig): Metadata {
  const url = `${appConfig.url}${appCanonicalPath(config.slug)}`;

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

export function appJsonLdScript(config: AppLandingConfig) {
  const pageUrl = `${appConfig.url}${appCanonicalPath(config.slug)}`;

  const graph = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `${appConfig.name} ${config.name}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    description: config.seo.description,
    url: pageUrl,
    offers: {
      '@type': 'Offer',
      name: config.name,
      price: config.fromPriceGbp,
      priceCurrency: 'GBP',
      url: pageUrl,
    },
    provider: {
      '@type': 'Organization',
      name: appConfig.name,
      url: appConfig.url,
    },
  };

  return JSON.stringify(graph);
}
