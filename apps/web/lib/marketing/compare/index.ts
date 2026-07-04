import { hellobonsaiComparison } from '~/lib/marketing/compare/competitors/hellobonsai';
import { honeybookComparison } from '~/lib/marketing/compare/competitors/honeybook';
import { productiveIoComparison } from '~/lib/marketing/compare/competitors/productive-io';
import { withmoxieComparison } from '~/lib/marketing/compare/competitors/withmoxie';
import type { ComparisonConfig } from '~/lib/marketing/compare/types';
import { buildMarketingMetadata } from '~/lib/seo/marketing-metadata';
import {
  breadcrumbJsonLd,
  faqPageJsonLd,
  schemaGraph,
  webPageJsonLd,
} from '~/lib/seo/schema';

const COMPARISON_PAGES: Record<string, ComparisonConfig> = {
  [hellobonsaiComparison.slug]: hellobonsaiComparison,
  [honeybookComparison.slug]: honeybookComparison,
  [withmoxieComparison.slug]: withmoxieComparison,
  [productiveIoComparison.slug]: productiveIoComparison,
};

export const COMPARISON_SLUGS = Object.keys(COMPARISON_PAGES);

export function getComparisonConfig(slug: string): ComparisonConfig | null {
  return COMPARISON_PAGES[slug] ?? null;
}

export function listComparisonConfigs(): ComparisonConfig[] {
  return COMPARISON_SLUGS.map((slug) => COMPARISON_PAGES[slug]!);
}

export function comparisonPath(slug: string): string {
  return `/compare/${slug}`;
}

export function buildComparisonMetadata(config: ComparisonConfig) {
  return buildMarketingMetadata({
    title: config.seo.title,
    description: config.seo.description,
    path: comparisonPath(config.slug),
    ogType: 'default',
    keywords: config.seo.keywords,
  });
}

export function buildComparisonJsonLd(config: ComparisonConfig) {
  const path = comparisonPath(config.slug);

  return schemaGraph([
    webPageJsonLd({
      name: config.seo.title,
      description: config.seo.description,
      path,
    }),
    breadcrumbJsonLd([
      { name: 'Home', path: '/' },
      { name: 'Compare', path: '/compare' },
      { name: config.competitorName, path },
    ]),
    faqPageJsonLd(config.faqs),
  ]);
}
