import 'server-only';

import type { PageJsonLd } from '~/lib/crawl/json-ld';
import { getObjectSchemaTypes, hasNonEmptyField } from '~/lib/crawl/json-ld';

import { normaliseHost } from './domain';
import type { SiteCrawlIssue } from './types';

function isHomepageUrl(url: string, domain: string): boolean {
  try {
    const host = normaliseHost(domain);
    const parsed = new URL(url);
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    const urlHost = parsed.hostname.toLowerCase().replace(/^www\./, '');

    return urlHost === host && pathname === '/';
  } catch {
    return false;
  }
}

function validateTypedObject(
  type: string,
  item: Record<string, unknown>,
): string | null {
  switch (type) {
    case 'FAQPage':
      if (!hasNonEmptyField(item.mainEntity)) {
        return 'FAQPage missing mainEntity';
      }
      return null;

    case 'Product':
      if (!hasNonEmptyField(item.name)) {
        return 'Product missing name';
      }
      if (
        !hasNonEmptyField(item.offers) &&
        !hasNonEmptyField(item.aggregateRating) &&
        !hasNonEmptyField(item.review)
      ) {
        return 'Product missing offers, aggregateRating, or review';
      }
      return null;

    case 'Article':
    case 'NewsArticle':
    case 'BlogPosting':
      if (!hasNonEmptyField(item.headline)) {
        return `${type} missing headline`;
      }
      if (!hasNonEmptyField(item.author)) {
        return `${type} missing author`;
      }
      if (!hasNonEmptyField(item.datePublished)) {
        return `${type} missing datePublished`;
      }
      return null;

    case 'LocalBusiness':
      if (!hasNonEmptyField(item.name)) {
        return 'LocalBusiness missing name';
      }
      if (!hasNonEmptyField(item.address)) {
        return 'LocalBusiness missing address';
      }
      return null;

    case 'Organization':
      if (!hasNonEmptyField(item.name)) {
        return 'Organization missing name';
      }
      return null;

    case 'WebSite':
      if (!hasNonEmptyField(item.name)) {
        return 'WebSite missing name';
      }
      if (!hasNonEmptyField(item.url)) {
        return 'WebSite missing url';
      }
      return null;

    case 'BreadcrumbList':
      if (!hasNonEmptyField(item.itemListElement)) {
        return 'BreadcrumbList missing itemListElement';
      }
      return null;

    default:
      return null;
  }
}

export function detectSchemaIssues(
  url: string,
  domain: string,
  jsonLd: PageJsonLd,
  statusCode: number,
): SiteCrawlIssue[] {
  if (statusCode !== 200) {
    return [];
  }

  const issues: SiteCrawlIssue[] = [];

  for (const error of jsonLd.parseErrors) {
    issues.push({
      code: 'malformed_schema',
      message: error,
    });
  }

  if (
    jsonLd.scriptTagCount === 0 &&
    jsonLd.schemaObjects.length === 0 &&
    isHomepageUrl(url, domain)
  ) {
    issues.push({
      code: 'missing_schema',
      message: 'Homepage has no JSON-LD structured data',
    });
  }

  for (const item of jsonLd.schemaObjects) {
    const types = getObjectSchemaTypes(item);

    if (types.length === 0) {
      issues.push({
        code: 'schema_missing_type',
        message: 'JSON-LD object missing @type',
      });
      continue;
    }

    for (const type of types) {
      const incomplete = validateTypedObject(type, item);
      if (incomplete) {
        issues.push({
          code: 'schema_incomplete',
          message: incomplete,
        });
      }
    }
  }

  return issues;
}
